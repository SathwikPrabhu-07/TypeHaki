import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  LayoutDashboard,
  Trophy,
  Users,
  Plus,
  IndianRupee,
  Keyboard,
  Loader2,
  AlertCircle,
  Trash2,
  PencilLine
} from "lucide-react";
import { useRounds, useLeaderboard, createRound, deleteRound, Round, getAllRegistrations, updateRegistration, deleteRegistration, updateRound } from "@/hooks/useFirestore";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sampleTypingText } from "@/lib/mockData";

export default function Admin() {
  const { user } = useAuth();
  const { rounds, loading: roundsLoading, error: roundsError } = useRounds();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedRoundId, setSelectedRoundId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState<string | null>(null);
  const [rejectLoading, setRejectLoading] = useState<string | null>(null);
  const [endContestLoading, setEndContestLoading] = useState<string | null>(null);
  const [deleteRegistrationLoading, setDeleteRegistrationLoading] = useState<string | null>(null);
  const [editRound, setEditRound] = useState<Round | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    registrationDeadline: "",
    typingDate: "",
    typingTimeStart: "",
    typingTimeEnd: "",
    entryFee: "",
    prizePool: "",
    duration: "60",
    typingText: "",
    status: "upcoming",
  });

  const [newRound, setNewRound] = useState({
    name: "",
    registrationDeadline: "",
    typingDate: "",
    typingTimeStart: "",
    typingTimeEnd: "",
    entryFee: "",
    prizePool: "",
    duration: "60",
    typingText: "",
  });
  const isCreatingFreeRound = newRound.entryFee.trim() === "" || (parseInt(newRound.entryFee) || 0) === 0;

  // Get leaderboard for selected round
  const { entries: leaderboardEntries, loading: leaderboardLoading } = useLeaderboard(selectedRoundId);

  // Calculate stats from real data
  const stats = [
    { label: "Total Rounds", value: rounds.length.toString(), icon: Trophy },
    { label: "Active Rounds", value: rounds.filter(r => r.status === 'registration_open' || r.status === 'active').length.toString(), icon: Keyboard },
    { label: "Total Participants", value: rounds.reduce((sum, r) => sum + r.participantCount, 0).toString(), icon: Users },
    { label: "Total Prize Pool", value: `₹${rounds.reduce((sum, r) => sum + r.prizePool, 0).toLocaleString()}`, icon: IndianRupee },
  ];

  const handleCreateRound = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);

    try {
      const parsedEntryFee = Math.max(0, parseInt(newRound.entryFee) || 0);
      const isFreeRound = parsedEntryFee === 0;
      const autoDate = format(new Date(), "yyyy-MM-dd");
      const parsedDuration = Math.max(10, parseInt(newRound.duration) || 60);
      const finalTypingText = isFreeRound
        ? (newRound.typingText.trim() || sampleTypingText)
        : newRound.typingText;
      await createRound({
        name: newRound.name,
        registrationDeadline: isFreeRound ? new Date("2099-12-31T23:59") : new Date(newRound.registrationDeadline),
        typingDate: isFreeRound ? autoDate : newRound.typingDate,
        typingTimeStart: isFreeRound ? "00:00" : newRound.typingTimeStart,
        typingTimeEnd: isFreeRound ? "23:59" : newRound.typingTimeEnd,
        entryFee: parsedEntryFee,
        prizePool: parseInt(newRound.prizePool) || 0,
        duration: parsedDuration,
        typingText: finalTypingText,
        status: isFreeRound ? 'active' : 'upcoming',
        type: 'tournament', // tournaments created via admin panel
        createdBy: user?.uid || '',
      });

      // Reset form
      setNewRound({
        name: "",
        registrationDeadline: "",
        typingDate: "",
        typingTimeStart: "",
        typingTimeEnd: "",
        entryFee: "",
        prizePool: "",
        duration: "60",
        typingText: "",
      });

      // Switch to rounds tab to see the new round
      setActiveTab("rounds");
    } catch (err) {
      console.error('Error creating round:', err);
      setCreateError(err instanceof Error ? err.message : 'Failed to create round');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRound = async (roundId: string) => {
    setIsDeleting(true);
    try {
      await deleteRound(roundId);
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting round:', err);
      alert('Failed to delete tournament: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditRound = (round: Round) => {
    setEditRound(round);
    setEditForm({
      name: round.name,
      registrationDeadline: format(new Date(round.registrationDeadline), "yyyy-MM-dd'T'HH:mm"),
      typingDate: round.typingDate,
      typingTimeStart: round.typingTimeStart,
      typingTimeEnd: round.typingTimeEnd,
      entryFee: round.entryFee.toString(),
      prizePool: round.prizePool.toString(),
      duration: round.duration.toString(),
      typingText: round.typingText,
      status: round.status,
    });
  };

  const handleUpdateRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRound) return;
    try {
      await updateRound(editRound.id, {
        name: editForm.name,
        registrationDeadline: new Date(editForm.registrationDeadline),
        typingDate: editForm.typingDate,
        typingTimeStart: editForm.typingTimeStart,
        typingTimeEnd: editForm.typingTimeEnd,
        entryFee: Math.max(0, parseInt(editForm.entryFee) || 0),
        prizePool: parseInt(editForm.prizePool) || 0,
        duration: parseInt(editForm.duration) || 60,
        typingText: editForm.typingText,
        status: editForm.status as Round["status"],
      });
      setEditRound(null);
    } catch (err) {
      console.error("Error updating round:", err);
      alert("Failed to update round.");
    }
  };

  const handleEndContest = async (roundId: string) => {
    if (!confirm("End this contest now? This will close the round.")) {
      return;
    }
    setEndContestLoading(roundId);
    try {
      await updateRound(roundId, { status: "closed" });
    } catch (err) {
      console.error("Failed to end contest:", err);
      alert("Failed to end contest.");
    } finally {
      setEndContestLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "registration_open":
        return <Badge variant="success">Registration Open</Badge>;
      case "upcoming":
        return <Badge variant="upcoming">Upcoming</Badge>;
      case "active":
        return <Badge variant="success">Active</Badge>;
      case "closed":
        return <Badge variant="closed">Closed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const loadRegistrations = async () => {
    setRegistrationsLoading(true);
    try {
      const data = await getAllRegistrations();
      setRegistrations(data);
    } catch (err) {
      console.error("Failed to load registrations:", err);
    } finally {
      setRegistrationsLoading(false);
    }
  };

  const approveRegistration = async (registration: any, paymentId: string) => {
    setApproveLoading(registration.id);
    try {
      await updateRegistration(registration.id, {
        paymentStatus: "completed",
        paymentId: paymentId.trim(),
      });
      await loadRegistrations();
    } catch (err) {
      console.error("Failed to approve registration:", err);
    } finally {
      setApproveLoading(null);
    }
  };

  const rejectRegistration = async (registration: any) => {
    if (!confirm("Reject and delete this registration? This cannot be undone.")) {
      return;
    }
    setRejectLoading(registration.id);
    try {
      await deleteRegistration(registration.id);
      await loadRegistrations();
    } catch (err) {
      console.error("Failed to reject registration:", err);
    } finally {
      setRejectLoading(null);
    }
  };

  const removeRegistration = async (registration: any) => {
    if (!confirm("Delete this registration? This cannot be undone.")) {
      return;
    }
    setDeleteRegistrationLoading(registration.id);
    try {
      await deleteRegistration(registration.id);
      await loadRegistrations();
    } catch (err) {
      console.error("Failed to delete registration:", err);
    } finally {
      setDeleteRegistrationLoading(null);
    }
  };

  if (roundsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Keyboard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="font-bold">TypeHaki</span>
              <Badge variant="secondary" className="ml-2">Admin</Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="rounds" className="gap-2">
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">Rounds</span>
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Leaderboard</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2" onClick={loadRegistrations}>
              <IndianRupee className="h-4 w-4" />
              <span className="hidden sm:inline">Payments</span>
            </TabsTrigger>
            <TabsTrigger value="create" className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create Round</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => (
                  <Card key={stat.label} className="bg-card/50 border-border/50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <stat.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{stat.value}</p>
                          <p className="text-sm text-muted-foreground">{stat.label}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle>Recent Rounds</CardTitle>
                </CardHeader>
                <CardContent>
                  {rounds.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No rounds created yet. Create your first round!
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {rounds.slice(0, 5).map((round) => (
                        <div key={round.id} className="flex items-start justify-between py-2">
                          <div>
                            <p className="font-medium">{round.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {round.participantCount} participants • ₹{round.prizePool.toLocaleString()} prize
                            </p>
                          </div>
                          {getStatusBadge(round.status)}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Rounds Tab */}
          <TabsContent value="rounds">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle>All Rounds</CardTitle>
                  <CardDescription>Manage competition rounds</CardDescription>
                </CardHeader>
                <CardContent>
                  {rounds.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No rounds created yet.
                    </div>
                  ) : (
                      <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Round Name</TableHead>
                          <TableHead>Typing Date</TableHead>
                          <TableHead>Entry Fee</TableHead>
                          <TableHead>Prize Pool</TableHead>
                          <TableHead>Participants</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rounds.map((round) => (
                          <TableRow key={round.id}>
                            <TableCell className="font-medium">{round.name}</TableCell>
                            <TableCell>{round.typingDate}</TableCell>
                            <TableCell>{round.entryFee === 0 ? "Free" : `₹${round.entryFee}`}</TableCell>
                            <TableCell className="text-primary font-medium">₹{round.prizePool.toLocaleString()}</TableCell>
                            <TableCell>{round.participantCount}</TableCell>
                            <TableCell>{getStatusBadge(round.status)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditRound(round)}
                                  className="gap-2"
                                >
                                  <PencilLine className="h-4 w-4" />
                                  Edit
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleEndContest(round.id)}
                                  disabled={endContestLoading === round.id}
                                  className="gap-2"
                                >
                                  {endContestLoading === round.id ? "Ending..." : "End Contest"}
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setDeleteConfirm(round.id)}
                                  disabled={isDeleting}
                                  className="gap-2"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle>Select Round</CardTitle>
                </CardHeader>
                <CardContent>
                  <select
                    className="w-full p-2 rounded-md bg-background border border-border"
                    value={selectedRoundId}
                    onChange={(e) => setSelectedRoundId(e.target.value)}
                  >
                    <option value="">Select a round...</option>
                    {rounds.map((round) => (
                      <option key={round.id} value={round.id}>{round.name}</option>
                    ))}
                  </select>
                </CardContent>
              </Card>

              {selectedRoundId && (
                <Card className="bg-card/50 border-border/50">
                  <CardHeader>
                    <CardTitle>Leaderboard</CardTitle>
                    <CardDescription>View performance for selected round</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {leaderboardLoading ? (
                      <div className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                      </div>
                    ) : leaderboardEntries.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No attempts yet for this round.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Rank</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="text-right">WPM</TableHead>
                            <TableHead className="text-right">Accuracy</TableHead>
                            <TableHead className="text-right">Score</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leaderboardEntries.map((entry, index) => (
                            <TableRow key={entry.id}>
                              <TableCell>#{index + 1}</TableCell>
                              <TableCell className="font-medium">{entry.userName}</TableCell>
                              <TableCell className="text-right font-mono">{entry.wpm}</TableCell>
                              <TableCell className="text-right font-mono">{entry.accuracy}%</TableCell>
                              <TableCell className="text-right font-mono text-primary font-semibold">{entry.score}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </TabsContent>

          {/* Create Round Tab */}
          <TabsContent value="create">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="bg-card/50 border-border/50 max-w-2xl">
                <CardHeader>
                  <CardTitle>Create New Round</CardTitle>
                  <CardDescription>Set up a new typing competition round</CardDescription>
                </CardHeader>
                <CardContent>
                  {createError && (
                    <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{createError}</span>
                    </div>
                  )}

                  <form onSubmit={handleCreateRound} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Round Name</Label>
                      <Input
                        id="name"
                        placeholder="e.g., TypeHaki Championship - Round 1"
                        value={newRound.name}
                        onChange={(e) => setNewRound({ ...newRound, name: e.target.value })}
                        required
                      />
                    </div>

                    {!isCreatingFreeRound && (
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="registrationDeadline">Registration Deadline</Label>
                          <Input
                            id="registrationDeadline"
                            type="datetime-local"
                            value={newRound.registrationDeadline}
                            onChange={(e) => setNewRound({ ...newRound, registrationDeadline: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="typingDate">Typing Date</Label>
                          <Input
                            id="typingDate"
                            type="date"
                            value={newRound.typingDate}
                            onChange={(e) => setNewRound({ ...newRound, typingDate: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                    )}

                    {!isCreatingFreeRound && (
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="typingTimeStart">Time Window Start</Label>
                          <Input
                            id="typingTimeStart"
                            type="time"
                            value={newRound.typingTimeStart}
                            onChange={(e) => setNewRound({ ...newRound, typingTimeStart: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="typingTimeEnd">Time Window End</Label>
                          <Input
                            id="typingTimeEnd"
                            type="time"
                            value={newRound.typingTimeEnd}
                            onChange={(e) => setNewRound({ ...newRound, typingTimeEnd: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="entryFee">Entry Fee (₹)</Label>
                        <Input
                          id="entryFee"
                          type="number"
                          min={0}
                          placeholder="Leave empty or 0 for free round"
                          value={newRound.entryFee}
                          onChange={(e) => setNewRound({ ...newRound, entryFee: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prizePool">Prize Pool (₹)</Label>
                        <Input
                          id="prizePool"
                          type="number"
                          min={0}
                          placeholder="5000"
                          value={newRound.prizePool}
                          onChange={(e) => setNewRound({ ...newRound, prizePool: e.target.value })}
                          required
                        />
                        {isCreatingFreeRound && (
                          <p className="text-xs text-muted-foreground mt-1">Only `name` and `prize pool` required for free rounds — contest will be active immediately and users can enter directly.</p>
                        )}
                      </div>
                      {!isCreatingFreeRound && (
                        <div className="space-y-2">
                          <Label htmlFor="duration">Duration (seconds)</Label>
                          <Input
                            id="duration"
                            type="number"
                            min={10}
                            placeholder="60"
                            value={newRound.duration}
                            onChange={(e) => setNewRound({ ...newRound, duration: e.target.value })}
                            required
                          />
                        </div>
                      )}
                    </div>
                    {isCreatingFreeRound && (
                      <p className="text-xs text-muted-foreground">
                        Free round mode: this contest goes active immediately and stays active until admin closes it.
                      </p>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="typingText">Typing Text</Label>
                      <Textarea
                        id="typingText"
                        placeholder="Enter the text that participants will type... (optional for free rounds)"
                        value={newRound.typingText}
                        onChange={(e) => setNewRound({ ...newRound, typingText: e.target.value })}
                        rows={5}
                        required={!isCreatingFreeRound}
                      />
                      <p className="text-xs text-muted-foreground">
                        {isCreatingFreeRound
                          ? "Optional: free rounds can use default sample text if left empty."
                          : "This is the text participants will type during the competition."}
                      </p>
                    </div>

                    <Separator />

                    <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isCreating}>
                      {isCreating ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="h-5 w-5 mr-2" />
                          Create Round
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle>Registrations</CardTitle>
                  <CardDescription>Approve payments</CardDescription>
                </CardHeader>
                <CardContent>
                  {registrationsLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                    </div>
                  ) : registrations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No registrations found.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Round</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                          <TableHead>Payment ID</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>UPI ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {registrations.map((reg) => (
                          <TableRow key={reg.id}>
                            <TableCell className="font-medium">{reg.fullName || reg.userId}</TableCell>
                            <TableCell>{reg.roundId}</TableCell>
                            <TableCell>{reg.paymentStatus}</TableCell>
                            <TableCell>
                              {reg.paymentStatus === "completed" ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">Approved</span>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => removeRegistration(reg)}
                                    disabled={deleteRegistrationLoading === reg.id}
                                  >
                                    {deleteRegistrationLoading === reg.id ? "Deleting..." : "Delete"}
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Input
                                    placeholder="payment_id"
                                    value={reg._paymentIdInput || ""}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setRegistrations((prev) =>
                                        prev.map((r) => (r.id === reg.id ? { ...r, _paymentIdInput: value } : r))
                                      );
                                    }}
                                    className="w-44 font-mono text-xs"
                                  />
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => approveRegistration(reg, reg._paymentIdInput || "")}
                                    disabled={approveLoading === reg.id}
                                  >
                                    {approveLoading === reg.id ? "Approving..." : "Mark Paid"}
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => rejectRegistration(reg)}
                                    disabled={rejectLoading === reg.id}
                                  >
                                    {rejectLoading === reg.id ? "Rejecting..." : "Reject"}
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-mono">{reg.paymentId || "-"}</TableCell>
                            <TableCell>{reg.paymentEmail || "-"}</TableCell>
                            <TableCell>{reg.paymentAmount ? `â‚¹${reg.paymentAmount}` : "-"}</TableCell>
                            <TableCell className="font-mono">{reg.paymentUpiId || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tournament?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the tournament and all associated registrations and attempts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteRound(deleteConfirm)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin inline" /> : null}
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Round Dialog */}
      <Dialog open={!!editRound} onOpenChange={(open) => !open && setEditRound(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Round</DialogTitle>
            <DialogDescription>Update tournament details, dates, and settings.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateRound} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Round Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-deadline">Registration Deadline</Label>
                <Input
                  id="edit-deadline"
                  type="datetime-local"
                  value={editForm.registrationDeadline}
                  onChange={(e) => setEditForm({ ...editForm, registrationDeadline: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-date">Typing Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editForm.typingDate}
                  onChange={(e) => setEditForm({ ...editForm, typingDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-start">Time Window Start</Label>
                <Input
                  id="edit-start"
                  type="time"
                  value={editForm.typingTimeStart}
                  onChange={(e) => setEditForm({ ...editForm, typingTimeStart: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end">Time Window End</Label>
                <Input
                  id="edit-end"
                  type="time"
                  value={editForm.typingTimeEnd}
                  onChange={(e) => setEditForm({ ...editForm, typingTimeEnd: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-fee">Entry Fee (₹)</Label>
                <Input
                  id="edit-fee"
                  type="number"
                  min={0}
                  value={editForm.entryFee}
                  onChange={(e) => setEditForm({ ...editForm, entryFee: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-prize">Prize Pool (₹)</Label>
                <Input
                  id="edit-prize"
                  type="number"
                  min={0}
                  value={editForm.prizePool}
                  onChange={(e) => setEditForm({ ...editForm, prizePool: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-duration">Duration (seconds)</Label>
                <Input
                  id="edit-duration"
                  type="number"
                  min={10}
                  value={editForm.duration}
                  onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-text">Typing Text</Label>
              <Textarea
                id="edit-text"
                value={editForm.typingText}
                onChange={(e) => setEditForm({ ...editForm, typingText: e.target.value })}
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <select
                id="edit-status"
                className="w-full p-2 rounded-md bg-background border border-border"
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              >
                <option value="upcoming">Upcoming</option>
                <option value="registration_open">Registration Open</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditRound(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="hero">
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
