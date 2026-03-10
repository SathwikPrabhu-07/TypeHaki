import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Play, RefreshCw, Trophy } from "lucide-react";
import { sampleTypingText } from "@/lib/mockData";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { submitAttempt, useAttempt, useRound } from "@/hooks/useFirestore";

type TestStatus = "rules" | "ready" | "typing" | "finished";

export default function TypingTest() {
  const location = useLocation();
  const { user, userProfile } = useAuth();
  const params = new URLSearchParams(location.search);
  const roundId = (location.state as { roundId?: string } | undefined)?.roundId || params.get("round") || "";
  const contestMode = Boolean(roundId);
  const contestKey = contestMode ? `contest_progress_${roundId}` : "";
  const contestDuration = 60;
  const { attempt, loading: attemptLoading } = useAttempt(contestMode ? roundId : "");
  const { round } = useRound(contestMode ? roundId : "");
  const [status, setStatus] = useState<TestStatus>("rules");
  const [timeLeft, setTimeLeft] = useState(contestDuration);
  const [typedText, setTypedText] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [isCompetition, setIsCompetition] = useState(false);
  const [clipboardWarning, setClipboardWarning] = useState(false);
  const [disqualified, setDisqualified] = useState(false);
  const [disqualifiedReason, setDisqualifiedReason] = useState<string | null>(null);
  const [submissionState, setSubmissionState] = useState<"idle" | "submitting" | "submitted" | "failed">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const hasSubmittedRef = useRef(false);
  const keyTimesRef = useRef<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const text = contestMode ? (round?.typingText || sampleTypingText) : sampleTypingText;

  const rules = [
    "You have only one attempt to complete this test",
    "Use of AI tools or extensions is strictly prohibited",
    "The test will auto-end when the timer reaches zero",
    "Your score is calculated based on WPM and accuracy",
  ];

  const calculateStats = useCallback(() => {
    if (!startTime) return;

    const timeElapsed = (Date.now() - startTime) / 1000 / 60; // in minutes
    const wordsTyped = typedText.trim() ? typedText.trim().split(/\s+/).length : 0;
    const calculatedWpm = Math.round(wordsTyped / timeElapsed) || 0;

    let correctChars = 0;
    for (let i = 0; i < typedText.length; i++) {
      if (typedText[i] === text[i]) correctChars++;
    }
    const calculatedAccuracy = typedText.length > 0
      ? Math.round((correctChars / typedText.length) * 100)
      : 100;

    setWpm(Number.isFinite(calculatedWpm) ? calculatedWpm : 0);
    setAccuracy(calculatedAccuracy);
  }, [typedText, startTime, text]);

  const getLiveStats = useCallback(() => {
    if (!startTime) {
      return { liveWpm: 0, liveAccuracy: 100 };
    }
    const elapsedMs = Math.max(1, Date.now() - startTime);
    const elapsedMinutes = elapsedMs / 1000 / 60;
    const wordsTyped = typedText.trim() ? typedText.trim().split(/\s+/).length : 0;
    const liveWpm = Math.max(0, Math.round(wordsTyped / elapsedMinutes) || 0);

    let correctChars = 0;
    for (let i = 0; i < typedText.length; i++) {
      if (typedText[i] === text[i]) correctChars++;
    }
    const liveAccuracy =
      typedText.length > 0 ? Math.max(0, Math.round((correctChars / typedText.length) * 100)) : 100;

    return { liveWpm, liveAccuracy };
  }, [startTime, typedText, text]);

  useEffect(() => {
    if (!contestMode || !contestKey) return;
    if (attemptLoading) return;
    if (attempt) {
      localStorage.removeItem(contestKey);
      setStatus("ready");
      return;
    }
    const raw = localStorage.getItem(contestKey);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as {
        startedAt: number;
        typedText: string;
      };
      const elapsed = (Date.now() - saved.startedAt) / 1000;
      const remaining = Math.max(0, contestDuration - Math.floor(elapsed));
      if (remaining <= 0) {
        localStorage.removeItem(contestKey);
        return;
      }
      setTypedText(saved.typedText || "");
      setTimeLeft(remaining);
      setStartTime(Date.now() - elapsed * 1000);
      setStatus("typing");
      setWpm(0);
      setAccuracy(100);
      setIsCompetition(true);
    } catch {
      localStorage.removeItem(contestKey);
    }
  }, [contestMode, contestKey, contestDuration, attempt, attemptLoading]);

  useEffect(() => {
    if (status !== "typing") return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setStatus("finished");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status]);

  // Debounce stat calculations to reduce re-renders (only update every 50ms during typing)
  useEffect(() => {
    if (status !== "typing") return;

    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new timeout for debounced calculation
    debounceRef.current = setTimeout(() => {
      calculateStats();
    }, 50);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [typedText, status, calculateStats]);

  useEffect(() => {
    if (status === "typing" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [status]);

  useEffect(() => {
    if (!contestMode || !contestKey) return;
    if (status !== "typing" || !startTime) return;
    const payload = {
      startedAt: startTime,
      typedText,
    };
    localStorage.setItem(contestKey, JSON.stringify(payload));
  }, [contestMode, contestKey, status, startTime, typedText]);

  useEffect(() => {
    if (!contestMode || !contestKey) return;
    if (status === "finished") {
      localStorage.removeItem(contestKey);
    }
  }, [contestMode, contestKey, status]);

  const handleStart = async () => {
    if (contestMode && attempt) return;
    setStatus("typing");
    setStartTime(Date.now());
    setTypedText("");
    setTimeLeft(contestDuration);
    setWpm(0);
    setAccuracy(100);
    setDisqualified(false);
    setDisqualifiedReason(null);
    setSubmissionState("idle");
    if (contestMode) {
      setIsCompetition(true);
    }
  };

  const handleRestart = () => {
    if (contestMode) return;
    setStatus("ready");
    setTypedText("");
    setTimeLeft(contestDuration);
    setWpm(0);
    setAccuracy(100);
    setStartTime(null);
    setDisqualified(false);
    setDisqualifiedReason(null);
    setSubmissionState("idle");
    hasSubmittedRef.current = false;
    if (contestMode && contestKey) {
      localStorage.removeItem(contestKey);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (status !== "typing") return;
    const value = e.target.value;
    if (value.length <= text.length) {
      setTypedText(value);
      if (value.length === text.length) {
        setStatus("finished");
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (status === "ready" && e.key === "Enter") {
      handleStart();
    }
  };

  const disqualify = (reason: string) => {
    if (disqualified) return;
    setDisqualified(true);
    setDisqualifiedReason(reason);
    setWpm(0);
    setAccuracy(0);
    setStatus("finished");
  };

  useEffect(() => {
    // Submission flow: when contest finishes submit attempt once
    if (contestMode && status === "finished" && user && !hasSubmittedRef.current) {
      (async () => {
        hasSubmittedRef.current = true;
        console.log("[TypingTest] submitting attempt for round:", roundId);
        setSubmissionState("submitting");
        const { liveWpm, liveAccuracy } = getLiveStats();
        const finalWpm = disqualified ? 0 : liveWpm;
        const finalAccuracy = disqualified ? 0 : liveAccuracy;
        const score = disqualified ? 0 : Math.round(finalWpm * (finalAccuracy / 100));

        const attemptPayload = {
          roundId,
          userId: user.uid,
          userName: userProfile?.name || user.displayName || "Participant",
          wpm: finalWpm,
          accuracy: finalAccuracy,
          score,
          typedText,
          startedAt: startTime ? new Date(startTime) : new Date(),
          disqualified,
          disqualifiedReason: disqualified ? disqualifiedReason || "Automation detected" : undefined,
        } as const;

        try {
          console.log("[TypingTest] attempt payload:", attemptPayload);
          await submitAttempt(attemptPayload as any);
          // mark locally so UI updates immediately and re-entry is prevented
          try {
            localStorage.setItem(`attempt_submitted_${roundId}`, JSON.stringify({
              id: `${roundId}_${user.uid}`,
              ...attemptPayload,
              submittedAt: new Date().toISOString(),
            }));
          } catch (e) {
            // ignore localStorage errors
          }
          setSubmissionState("submitted");
          setSubmitError(null);
          console.log("[TypingTest] submission succeeded for:", roundId, user.uid);
        } catch (err: any) {
          console.error("Failed to submit attempt:", err);
          const msg = err instanceof Error ? err.message : String(err);
          setSubmitError(msg);
          if (msg.toLowerCase().includes("already")) {
            setSubmissionState("submitted");
            console.log("[TypingTest] submission already exists, treating as submitted");
          } else {
            setSubmissionState("failed");
            console.log("[TypingTest] submission failed for:", roundId, user?.uid, msg);
          }
        }
      })();
    }

    // Clipboard / key listeners - always attach so user can't copy/paste
    const onCopyCutPaste = (e: Event) => {
      e.preventDefault();
      setClipboardWarning(true);
    };

    const onDocKeyDown = (e: KeyboardEvent) => {
      if (status === "ready" && e.key === "Enter") {
        handleStart();
      }
    };

    document.addEventListener("keydown", onDocKeyDown);
    document.addEventListener("copy", onCopyCutPaste);
    document.addEventListener("cut", onCopyCutPaste);
    document.addEventListener("paste", onCopyCutPaste);

    return () => {
      document.removeEventListener("keydown", onDocKeyDown);
      document.removeEventListener("copy", onCopyCutPaste);
      document.removeEventListener("cut", onCopyCutPaste);
      document.removeEventListener("paste", onCopyCutPaste);
    };
  }, [contestMode, status, user, roundId, userProfile, typedText, startTime, disqualified, getLiveStats]);

  // Safety: ensure status becomes 'finished' when timer reaches zero
  useEffect(() => {
    if (timeLeft === 0 && status !== "finished") {
      console.log("[TypingTest] timeLeft reached 0, forcing finish");
      setStatus("finished");
    }
  }, [timeLeft, status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Memoize rendered text to prevent unnecessary re-renders
  const renderedText = useMemo(() => {
    return text.split("").map((char, index) => {
      let className = "text-muted-foreground";

      if (index < typedText.length) {
        className = typedText[index] === char
          ? "text-success"
          : "text-destructive bg-destructive/20";
      }

      if (index === typedText.length) {
        return (
          <span key={index} className="relative">
            <span className="absolute -left-[1px] w-[2px] h-6 bg-primary animate-cursor-blink" />
            <span className={className}>{char}</span>
          </span>
        );
      }

      return (
        <span key={index} className={className}>
          {char}
        </span>
      );
    });
  }, [typedText, text]);

  const renderText = () => renderedText;

  return (
    <Layout showFooter={false}>
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          {status === "rules" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="bg-card/50 border-border/50">
                <CardContent className="py-12 space-y-8">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-warning/10 flex items-center justify-center">
                      <AlertTriangle className="h-8 w-8 text-warning" />
                    </div>
                    <h2 className="text-2xl font-bold">Before You Start</h2>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Please read and understand the following rules before beginning your typing test.
                    </p>
                  </div>

                  <div className="max-w-md mx-auto space-y-4">
                    {rules.map((rule, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <span className="text-muted-foreground">{rule}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-3">
                      <Badge variant={isCompetition ? "success" : "secondary"}>
                        {isCompetition ? "Competition Mode" : "Practice Mode"}
                      </Badge>
                      {!contestMode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsCompetition(!isCompetition)}
                        >
                          Switch Mode
                        </Button>
                      )}
                    </div>
                    <Button variant="hero" size="xl" onClick={() => setStatus("ready")}>
                      I Understand, Continue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {status === "ready" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center space-y-8"
            >
              <div className="space-y-4">
                <Badge variant={isCompetition ? "success" : "secondary"} className="text-sm">
                  {isCompetition ? "Competition Mode" : "Practice Mode"}
                </Badge>
                <h2 className="text-3xl font-bold">Ready to Type?</h2>
                <p className="text-muted-foreground">
                  Click the button below or press Enter to start the test
                </p>
                {contestMode && attempt && (
                  <p className="text-sm text-destructive">
                    You have already completed this contest. Retries are disabled.
                  </p>
                )}
              </div>

              <div className="text-6xl font-mono font-bold text-primary">
                {formatTime(timeLeft)}
              </div>

              <Button
                variant="hero"
                size="xl"
                onClick={handleStart}
                onKeyDown={handleKeyDown}
                className="animate-pulse-glow"
                disabled={contestMode && (attemptLoading || !!attempt)}
              >
                <Play className="h-5 w-5" />
                Start Test
              </Button>
            </motion.div>
          )}

          {status === "typing" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {contestMode && clipboardWarning && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                  Copy/paste is disabled during the contest.
                </div>
              )}
              {/* Stats Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-3xl font-mono font-bold">{wpm}</p>
                    <p className="text-sm text-muted-foreground">WPM</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-mono font-bold">{accuracy}%</p>
                    <p className="text-sm text-muted-foreground">Accuracy</p>
                  </div>
                </div>
                <div className="text-center">
                  <p className={`text-5xl font-mono font-bold ${timeLeft <= 10 ? 'text-destructive' : 'text-primary'}`}>
                    {formatTime(timeLeft)}
                  </p>
                </div>
              </div>

              {/* Typing Area */}
              <Card className="bg-card/50 border-border/50">
                <CardContent className="py-12">
                  <div
                    className="font-mono text-lg md:text-xl leading-relaxed cursor-text"
                    onClick={() => inputRef.current?.focus()}
                  >
                    {renderText()}
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={typedText}
                    onChange={handleInput}
                    className="absolute opacity-0 -z-10"
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    onPaste={(e) => contestMode && e.preventDefault()}
                    onCopy={(e) => contestMode && e.preventDefault()}
                    onCut={(e) => contestMode && e.preventDefault()}
                  />
                </CardContent>
              </Card>

              <p className="text-center text-sm text-muted-foreground">
                Start typing to begin. Click on the text area if keyboard isn't responding.
              </p>
            </motion.div>
          )}

          {status === "finished" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="bg-card/50 border-border/50">
                <CardContent className="py-12 space-y-8">
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                      <Trophy className="h-10 w-10 text-primary" />
                    </div>
                    <h2 className="text-3xl font-bold">
                      {disqualified ? "Attempt Disqualified" : "Test Complete!"}
                    </h2>
                    <p className="text-muted-foreground">
                      {disqualified
                        ? disqualifiedReason || "Automation detected."
                        : isCompetition
                        ? "Your result has been submitted. Check the leaderboard for your ranking."
                        : "Great practice session! Try again to improve your score."}
                    </p>
                    {contestMode && submissionState === "submitting" && (
                      <p className="text-sm text-muted-foreground">Saving your result...</p>
                    )}
                    {contestMode && submissionState === "failed" && (
                        <div className="space-y-2">
                          <p className="text-sm text-destructive">Could not save result. Retry from this page.</p>
                          {submitError && (
                            <pre className="text-xs text-destructive whitespace-pre-wrap">{submitError}</pre>
                          )}
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // allow retry by resetting submitted flag and re-triggering effect
                                hasSubmittedRef.current = false;
                                setSubmissionState("idle");
                                setStatus("finished");
                              }}
                            >
                              Retry Submit
                            </Button>
                          </div>
                        </div>
                    )}
                  </div>

                  <div className="flex justify-center gap-12">
                    <div className="text-center">
                      <p className="text-5xl font-mono font-bold text-primary">{wpm}</p>
                      <p className="text-muted-foreground">Words per Minute</p>
                    </div>
                    <div className="text-center">
                      <p className="text-5xl font-mono font-bold">{accuracy}%</p>
                      <p className="text-muted-foreground">Accuracy</p>
                    </div>
                  </div>

                  <div className="flex justify-center gap-4">
                    {!isCompetition && (
                      <Button variant="outline" size="lg" onClick={handleRestart}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Try Again
                      </Button>
                    )}
                    <Link to={contestMode && roundId ? `/leaderboard?round=${roundId}` : "/leaderboard"}>
                      <Button
                        variant="hero"
                        size="lg"
                        disabled={contestMode && submissionState === "submitting"}
                      >
                        <Trophy className="h-4 w-4 mr-2" />
                        View Leaderboard
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </Layout>
  );
}
