import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Medal, Award, Loader2 } from "lucide-react";
import { useRounds, useLeaderboard } from "@/hooks/useFirestore";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";

export default function Leaderboard() {
  const { user } = useAuth();
  const location = useLocation();
  const { rounds, loading: roundsLoading } = useRounds();
  const [selectedRoundId, setSelectedRoundId] = useState<string>("");
  const { entries, loading: leaderboardLoading } = useLeaderboard(selectedRoundId);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-warning" />;
      case 2:
        return <Medal className="h-5 w-5 text-muted-foreground" />;
      case 3:
        return <Award className="h-5 w-5 text-warning" />;
      default:
        return null;
    }
  };

  // Find current user's entry
  const currentUserEntry = entries.find((entry) => entry.userId === user?.uid);
  const currentUserRank = currentUserEntry
    ? entries.findIndex((entry) => entry.userId === user?.uid) + 1
    : null;

  useEffect(() => {
    if (!rounds.length) return;
    const params = new URLSearchParams(location.search);
    const roundFromQuery = params.get("round");
    if (roundFromQuery && rounds.some((r) => r.id === roundFromQuery) && selectedRoundId !== roundFromQuery) {
      setSelectedRoundId(roundFromQuery);
      return;
    }
    if (!selectedRoundId || !rounds.some((r) => r.id === selectedRoundId)) {
      const defaultRound = rounds.find((r) => r.status === "active") || rounds[0];
      if (defaultRound) {
      setSelectedRoundId(defaultRound.id);
      }
    }
  }, [location.search, rounds, selectedRoundId]);

  if (roundsLoading) {
    return (
      <Layout>
        <div className="container py-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Leaderboard</h1>
            <p className="text-muted-foreground">
              Top performers from typing tournaments
            </p>
          </div>

          {/* Round Selector */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Select Round</CardTitle>
            </CardHeader>
            <CardContent>
              {rounds.length === 0 ? (
                <p className="text-muted-foreground">No tournaments available yet.</p>
              ) : (
                <select
                  className="w-full p-2 rounded-md bg-background border border-border"
                  value={selectedRoundId}
                  onChange={(e) => setSelectedRoundId(e.target.value)}
                >
                  <option value="">Select a tournament to view leaderboard...</option>
                  {rounds.map((round) => (
                    <option key={round.id} value={round.id}>
                      {round.name} ({round.status})
                    </option>
                  ))}
                </select>
              )}
            </CardContent>
          </Card>

          {selectedRoundId && (
            <>
              {/* Current User Highlight */}
              {currentUserEntry && currentUserRank && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Your Position
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                          #{currentUserRank}
                        </div>
                        <div>
                          <p className="font-semibold">{currentUserEntry.userName}</p>
                          <p className="text-sm text-muted-foreground">
                            {currentUserEntry.wpm} WPM • {currentUserEntry.accuracy}% Accuracy
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">{currentUserEntry.score}</p>
                        <p className="text-sm text-muted-foreground">Score</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Leaderboard Table */}
              <Card className="bg-card/50 border-border/50 overflow-hidden">
                {leaderboardLoading ? (
                  <CardContent className="py-8 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                  </CardContent>
                ) : entries.length === 0 ? (
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No entries yet for this round.
                  </CardContent>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-20">Rank</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">WPM</TableHead>
                        <TableHead className="text-right">Accuracy</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry, index) => {
                        const rank = index + 1;
                        const isCurrentUser = entry.userId === user?.uid;

                        return (
                          <TableRow
                            key={entry.id}
                            className={isCurrentUser ? "bg-primary/5" : ""}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getRankIcon(rank)}
                                <span className={`font-medium ${rank <= 3 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  #{rank}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{entry.userName}</span>
                                {isCurrentUser && (
                                  <Badge variant="secondary" className="text-xs">You</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">{entry.wpm}</TableCell>
                            <TableCell className="text-right font-mono">{entry.accuracy}%</TableCell>
                            <TableCell className="text-right font-mono font-semibold text-primary">
                              {entry.score}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </Card>

              <p className="text-center text-sm text-muted-foreground">
                Score = WPM × (Accuracy / 100)²
              </p>
            </>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
