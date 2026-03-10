import { useState, useEffect } from 'react';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    DocumentData
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sampleTypingText } from '@/lib/mockData';
import { useAuth } from '@/contexts/AuthContext';

// Round type definition
export interface Round {
    id: string;
    name: string;
    registrationDeadline: Date;
    typingDate: string;
    typingTimeStart: string;
    typingTimeEnd: string;
    entryFee: number;
    prizePool: number;
    typingText: string;
    duration: number; // in seconds
    status: 'upcoming' | 'registration_open' | 'active' | 'closed';
    type: 'tournament' | 'practice'; // 'tournament' for competitions, 'practice' for general practice
    paymentLinkUrl?: string;
    participantCount: number;
    createdAt: Date;
    createdBy: string;
}

// Registration type definition
export interface Registration {
    id: string;
    roundId: string;
    userId: string;
    fullName: string;
    mobile: string;
    college: string;
    branch: string;
    section: string;
    rollNumber: string;
    paymentStatus: 'pending' | 'completed' | 'failed';
    paymentId?: string;
    orderId?: string;
    paymentEmail?: string;
    paymentAmount?: number;
    paymentUpiId?: string;
    createdAt: Date;
}

// Attempt type definition
export interface Attempt {
    id: string;
    roundId: string;
    userId: string;
    userName: string;
    wpm: number;
    accuracy: number;
    score: number;
    typedText: string;
    startedAt: Date;
    submittedAt: Date;
    disqualified?: boolean;
    disqualifiedReason?: string;
}

// Helper to convert Firestore Timestamp to Date
function toDate(timestamp: Timestamp | Date | undefined): Date {
    if (!timestamp) return new Date();
    if (timestamp instanceof Timestamp) {
        return timestamp.toDate();
    }
    return timestamp;
}

// Helper to convert Firestore document to Round
function docToRound(id: string, data: DocumentData): Round {
    const derivedStatus = deriveRoundStatus(
        data.status,
        data.registrationDeadline,
        data.typingDate,
        data.typingTimeStart,
        data.typingTimeEnd
    );

    return {
        id,
        name: data.name || '',
        registrationDeadline: toDate(data.registrationDeadline),
        typingDate: data.typingDate || '',
        typingTimeStart: data.typingTimeStart || '',
        typingTimeEnd: data.typingTimeEnd || '',
        entryFee: data.entryFee || 0,
        prizePool: data.prizePool || 0,
        typingText: data.typingText || '',
        duration: data.duration || 60,
        status: derivedStatus,
        type: data.type || 'tournament', // default to tournament for backward compatibility
        paymentLinkUrl: data.paymentLinkUrl || '',
        participantCount: data.participantCount || 0,
        createdAt: toDate(data.createdAt),
        createdBy: data.createdBy || '',
    };
}

function parseDateTime(dateStr?: string, timeStr?: string): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    const [year, month, day] = parts;
    if (!timeStr) return new Date(year, month - 1, day, 0, 0, 0, 0);
    const timeParts = timeStr.split(":").map(Number);
    if (timeParts.length < 2 || timeParts.some(Number.isNaN)) {
        return new Date(year, month - 1, day, 0, 0, 0, 0);
    }
    const [hour, minute] = timeParts;
    return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function deriveRoundStatus(
    storedStatus: Round["status"] | undefined,
    registrationDeadlineRaw: Timestamp | Date | undefined,
    typingDate?: string,
    typingTimeStart?: string,
    typingTimeEnd?: string
): Round["status"] {
    // If admin explicitly set a non-upcoming status, respect it.
    if (storedStatus && storedStatus !== "upcoming") {
        return storedStatus;
    }

    const now = new Date();
    const registrationDeadline = toDate(registrationDeadlineRaw);
    const deadlineValid = registrationDeadline instanceof Date && !Number.isNaN(registrationDeadline.getTime());
    if (deadlineValid && now <= registrationDeadline) {
        return "registration_open";
    }

    const start = parseDateTime(typingDate, typingTimeStart);
    const end = parseDateTime(typingDate, typingTimeEnd);
    if (start && end && now >= start && now <= end) {
        return "active";
    }

    if (start && now < start) {
        return "upcoming";
    }

    return "closed";
}

function getWordsCount(text: string): number {
    const normalized = text.trim();
    return normalized ? normalized.split(/\s+/).length : 0;
}

function normalizeAttemptStats(attempt: Attempt, referenceText: string): Attempt {
    if (attempt.disqualified) return attempt;

    const typed = attempt.typedText || "";
    if (!typed.trim()) return attempt;

    const hasSavedStats = attempt.wpm > 0 || attempt.score > 0 || attempt.accuracy > 0;
    if (hasSavedStats) return attempt;

    const startedMs = attempt.startedAt instanceof Date ? attempt.startedAt.getTime() : Date.now();
    const submittedMs = attempt.submittedAt instanceof Date ? attempt.submittedAt.getTime() : Date.now();
    const elapsedMs = Math.max(1, submittedMs - startedMs);
    const elapsedMinutes = elapsedMs / 1000 / 60;

    const wordsTyped = getWordsCount(typed);
    const derivedWpm = Math.max(0, Math.round(wordsTyped / elapsedMinutes) || 0);

    let correctChars = 0;
    for (let i = 0; i < typed.length; i++) {
        if (typed[i] === referenceText[i]) correctChars++;
    }
    const derivedAccuracy = typed.length > 0 ? Math.max(0, Math.round((correctChars / typed.length) * 100)) : 100;
    const derivedScore = Math.max(0, Math.round(derivedWpm * (derivedAccuracy / 100)));

    return {
        ...attempt,
        wpm: derivedWpm,
        accuracy: derivedAccuracy,
        score: derivedScore,
    };
}

// Hook to fetch all rounds (one-time read for better performance)
export function useRounds() {
    const [rounds, setRounds] = useState<Round[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const fetchRounds = async () => {
            try {
                const roundsRef = collection(db, 'rounds');
                const q = query(roundsRef, orderBy('createdAt', 'desc'));
                const snapshot = await getDocs(q);
                
                const roundsData = snapshot.docs.map(doc => docToRound(doc.id, doc.data()));
                setRounds(roundsData);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching rounds:', err);
                setError(err instanceof Error ? err : new Error('Unknown error'));
                setLoading(false);
            }
        };

        fetchRounds();
    }, []);

    return { rounds, loading, error };
}

// Hook to fetch a single round by ID
export function useRound(roundId: string) {
    const [round, setRound] = useState<Round | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!roundId) {
            setRound(null);
            setLoading(false);
            return;
        }

        const roundRef = doc(db, 'rounds', roundId);

        const unsubscribe = onSnapshot(roundRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    setRound(docToRound(snapshot.id, snapshot.data()));
                } else {
                    setRound(null);
                }
                setLoading(false);
            },
            (err) => {
                console.error('Error fetching round:', err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [roundId]);

    return { round, loading, error };
}

// Hook to fetch leaderboard for a round
export function useLeaderboard(roundId: string) {
    const [entries, setEntries] = useState<Attempt[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!roundId) {
            setEntries([]);
            setLoading(false);
            return;
        }

        let unsubscribe: (() => void) | null = null;
        let isMounted = true;

        const subscribeLeaderboard = async () => {
            try {
                let referenceText = sampleTypingText;
                const roundRef = doc(db, 'rounds', roundId);
                const roundSnapshot = await getDoc(roundRef);
                if (roundSnapshot.exists()) {
                    const roundData = roundSnapshot.data();
                    if (roundData.typingText && typeof roundData.typingText === 'string') {
                        referenceText = roundData.typingText;
                    }
                }

                const attemptsRef = collection(db, 'attempts');
                // Fetch attempts for the round without server-side ordering
                // to avoid requiring composite indexes. We'll sort client-side.
                const q = query(
                    attemptsRef,
                    where('roundId', '==', roundId)
                );

                unsubscribe = onSnapshot(
                    q,
                    (snapshot) => {
                        if (!isMounted) return;
                        const attemptsData = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data(),
                            startedAt: toDate(doc.data().startedAt),
                            submittedAt: toDate(doc.data().submittedAt),
                        } as Attempt));
                        // Include any locally-submitted attempt so leaderboard updates immediately
                        let attemptsWithLocal = attemptsData.slice();
                        try {
                            const localRaw = typeof window !== 'undefined' ? localStorage.getItem(`attempt_submitted_${roundId}`) : null;
                            if (localRaw) {
                                const localAttempt = JSON.parse(localRaw);
                                const exists = attemptsWithLocal.some(a => a.userId === localAttempt.userId);
                                if (!exists) {
                                    attemptsWithLocal.push({
                                        id: localAttempt.id || `${roundId}_${localAttempt.userId}`,
                                        roundId: localAttempt.roundId,
                                        userId: localAttempt.userId,
                                        userName: localAttempt.userName || 'Participant',
                                        wpm: localAttempt.wpm || 0,
                                        accuracy: localAttempt.accuracy || 0,
                                        score: localAttempt.score || 0,
                                        typedText: localAttempt.typedText || '',
                                        startedAt: localAttempt.startedAt ? new Date(localAttempt.startedAt) : new Date(),
                                        submittedAt: localAttempt.submittedAt ? new Date(localAttempt.submittedAt) : new Date(),
                                    } as Attempt);
                                }
                            }
                        } catch (e) {
                            // ignore parse errors
                        }

                        const normalized = attemptsWithLocal
                            .filter((attempt) => !attempt.disqualified)
                            .map((attempt) => normalizeAttemptStats(attempt, referenceText))
                            .sort((a, b) => b.score - a.score || b.wpm - a.wpm || b.accuracy - a.accuracy);
                        setEntries(normalized);
                        setLoading(false);
                    },
                    (err) => {
                        if (!isMounted) return;
                        console.error('Error fetching leaderboard:', err);
                        setError(err instanceof Error ? err : new Error('Unknown error'));
                        setLoading(false);
                    }
                );
            } catch (err) {
                if (!isMounted) return;
                console.error('Error preparing leaderboard subscription:', err);
                setError(err instanceof Error ? err : new Error('Unknown error'));
                setLoading(false);
            }
        };

        subscribeLeaderboard();

        return () => {
            isMounted = false;
            if (unsubscribe) unsubscribe();
        };
    }, [roundId]);

    return { entries, loading, error };
}

// Hook to check if user has registered for a round
export function useRegistration(roundId: string) {
    const { user } = useAuth();
    const [registration, setRegistration] = useState<Registration | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!roundId || !user) {
            setLoading(false);
            return;
        }

        const registrationsRef = collection(db, 'registrations');
        const q = query(
            registrationsRef,
            where('roundId', '==', roundId),
            where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    setRegistration({
                        id: doc.id,
                        ...doc.data(),
                        createdAt: toDate(doc.data().createdAt),
                    } as Registration);
                } else {
                    setRegistration(null);
                }
                setLoading(false);
            },
            (err) => {
                console.error('Error fetching registration:', err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [roundId, user]);

    return { registration, loading, error };
}

// Hook to check if user has attempted a round
export function useAttempt(roundId: string) {
    const { user } = useAuth();
    const [attempt, setAttempt] = useState<Attempt | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!roundId || !user) {
            setLoading(false);
            return;
        }

        const attemptsRef = collection(db, 'attempts');
        const q = query(
            attemptsRef,
            where('roundId', '==', roundId),
            where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    setAttempt({
                        id: doc.id,
                        ...doc.data(),
                        startedAt: toDate(doc.data().startedAt),
                        submittedAt: toDate(doc.data().submittedAt),
                    } as Attempt);
                } else {
                    setAttempt(null);
                }
                setLoading(false);
            },
            (err) => {
                console.error('Error fetching attempt:', err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [roundId, user]);

    return { attempt, loading, error };
}

// Hook to fetch user's competition history (one-time read)
export function useUserHistory() {
    const { user } = useAuth();
    const [attempts, setAttempts] = useState<Attempt[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const fetchUserHistory = async () => {
            try {
                const attemptsRef = collection(db, 'attempts');
                const q = query(
                    attemptsRef,
                    where('userId', '==', user.uid),
                    orderBy('submittedAt', 'desc')
                );
                const snapshot = await getDocs(q);
                
                const attemptsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    startedAt: toDate(doc.data().startedAt),
                    submittedAt: toDate(doc.data().submittedAt),
                } as Attempt));
                setAttempts(attemptsData);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching user history:', err);
                setError(err instanceof Error ? err : new Error('Unknown error'));
                setLoading(false);
            }
        };

        fetchUserHistory();
    }, [user]);

    return { attempts, loading, error };
}

// Admin: Create a new round
export async function createRound(roundData: Omit<Round, 'id' | 'createdAt' | 'participantCount'>) {
    const roundsRef = collection(db, 'rounds');

    const docRef = await addDoc(roundsRef, {
        ...roundData,
        participantCount: 0,
        createdAt: serverTimestamp(),
    });

    return docRef.id;
}

// Admin: Update a round
export async function updateRound(roundId: string, updates: Partial<Round>) {
    const roundRef = doc(db, 'rounds', roundId);
    await updateDoc(roundRef, updates);
}

// Admin: Delete a round and associated data
export async function deleteRound(roundId: string) {
    // Delete registrations
    const registrationsRef = collection(db, 'registrations');
    const regQuery = query(registrationsRef, where('roundId', '==', roundId));
    const regSnapshot = await getDocs(regQuery);
    
    for (const regDoc of regSnapshot.docs) {
        await deleteDoc(regDoc.ref);
    }

    // Delete attempts
    const attemptsRef = collection(db, 'attempts');
    const attQuery = query(attemptsRef, where('roundId', '==', roundId));
    const attSnapshot = await getDocs(attQuery);
    
    for (const attDoc of attSnapshot.docs) {
        await deleteDoc(attDoc.ref);
    }

    // Delete the round itself
    const roundRef = doc(db, 'rounds', roundId);
    await deleteDoc(roundRef);
}

// Admin: Get all registrations
export async function getAllRegistrations(): Promise<Registration[]> {
    const registrationsRef = collection(db, 'registrations');
    const snapshot = await getDocs(registrationsRef);

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: toDate(doc.data().createdAt),
    } as Registration));
}

// Admin: Update registration
export async function updateRegistration(registrationId: string, updates: Partial<Registration>) {
    const regRef = doc(db, 'registrations', registrationId);
    await updateDoc(regRef, updates);
}

// Admin: Delete registration
export async function deleteRegistration(registrationId: string) {
    const regRef = doc(db, 'registrations', registrationId);
    await deleteDoc(regRef);
}

// Create registration
export async function createRegistration(registrationData: Omit<Registration, 'id' | 'createdAt'>) {
    const registrationsRef = collection(db, 'registrations');

    // Check if roll number is already registered for this round (skip if empty)
    if (registrationData.rollNumber) {
        const q = query(
            registrationsRef,
            where('roundId', '==', registrationData.roundId),
            where('rollNumber', '==', registrationData.rollNumber)
        );
        const existing = await getDocs(q);

        if (!existing.empty) {
            throw new Error('This roll number is already registered for this round');
        }
    }

    const docRef = await addDoc(registrationsRef, {
        ...registrationData,
        createdAt: serverTimestamp(),
    });

    return docRef.id;
}

// Submit typing attempt
export async function submitAttempt(attemptData: Omit<Attempt, 'id' | 'submittedAt'>) {
    const attemptsRef = collection(db, 'attempts');
    const attemptId = `${attemptData.roundId}_${attemptData.userId}`;
    const attemptRef = doc(attemptsRef, attemptId);

    // Check if user has already attempted this round
    const q = query(
        attemptsRef,
        where('roundId', '==', attemptData.roundId),
        where('userId', '==', attemptData.userId)
    );
    const existing = await getDocs(q);

    if (!existing.empty) {
        throw new Error('You have already attempted this round');
    }

    // Filter out undefined values to avoid Firestore errors
    const cleanedData = Object.fromEntries(
        Object.entries(attemptData).filter(([_, value]) => value !== undefined)
    );

    await setDoc(attemptRef, {
        ...cleanedData,
        submittedAt: serverTimestamp(),
    });

    return attemptId;
}

// Admin: Get all registrations for a round
export async function getRegistrationsByRound(roundId: string): Promise<Registration[]> {
    const registrationsRef = collection(db, 'registrations');
    const q = query(registrationsRef, where('roundId', '==', roundId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: toDate(doc.data().createdAt),
    } as Registration));
}
