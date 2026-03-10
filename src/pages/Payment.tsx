import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createRegistration, updateRegistration, useRegistration } from "@/hooks/useFirestore";
import { useToast } from "@/components/ui/use-toast";

type PaymentStatus = "pending" | "processing" | "success" | "failed";

export default function Payment() {
  const location = useLocation();
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<PaymentStatus>("pending");
  const [showDetailsForm, setShowDetailsForm] = useState(false);
  const [paymentId, setPaymentId] = useState("");
  const [paymentUpiId, setPaymentUpiId] = useState("");

  const params = new URLSearchParams(location.search);
  const roundIdFromQuery = params.get("roundId") || params.get("round") || "";
  const round = location.state?.round || {
    id: "default-round",
    name: "TypeHaki Championship - Round 1",
    entryFee: 49,
    typingDate: "2026-02-12",
  };
  const roundId = round.id !== "default-round" ? round.id : roundIdFromQuery || round.id;
  const isFreeRound = Number(round.entryFee || 0) === 0;
  const { registration } = useRegistration(roundId);
  const isReturnFromPayment = params.get("payment") === "done" || params.get("payment_status") === "success";

  const handleSubmitPaymentDetails = async () => {
    if (isFreeRound) {
      toast({
        title: "No payment needed",
        description: "This round is free entry. Use the register button.",
      });
      return;
    }

    if (!user || !userProfile) {
      toast({
        title: "Error",
        description: "Please login first",
        variant: "destructive",
      });
      return;
    }

    if (!paymentUpiId.trim()) {
      toast({
        title: "Missing details",
        description: "Please fill UPI ID.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (registration) {
        await updateRegistration(registration.id, {
          paymentId: paymentId.trim(),
          paymentUpiId: paymentUpiId.trim(),
          paymentStatus: "pending",
        });
      } else {
        await createRegistration({
          roundId,
          userId: user.uid,
          fullName: userProfile.name || user.displayName || "",
          mobile: userProfile.mobile || user.phoneNumber || "",
          college: userProfile.college || "",
          branch: userProfile.branch || "",
          section: userProfile.section || "",
          rollNumber: userProfile.rollNumber || "",
          paymentStatus: "pending",
          paymentId: paymentId.trim(),
          orderId: "",
          paymentUpiId: paymentUpiId.trim(),
        });
      }
      toast({
        title: "Submitted",
        description: "Payment details submitted. Awaiting admin approval.",
      });
      setShowDetailsForm(false);
    } catch (error) {
      console.error("Failed to submit payment details:", error);
      toast({
        title: "Error",
        description: "Failed to submit payment details.",
        variant: "destructive",
      });
    }
  };

  const handlePayment = async () => {
    if (!user || !userProfile) {
      toast({
        title: "Error",
        description: "Please login first",
        variant: "destructive",
      });
      return;
    }

    try {
      await createRegistration({
        roundId,
        userId: user.uid,
        fullName: userProfile.name || user.displayName || "",
        mobile: userProfile.mobile || user.phoneNumber || "",
        college: userProfile.college || "",
        branch: userProfile.branch || "",
        section: userProfile.section || "",
        rollNumber: userProfile.rollNumber || "",
        paymentStatus: isFreeRound ? "completed" : "pending",
        paymentId: isFreeRound ? "FREE_ENTRY" : "",
        orderId: "",
        paymentAmount: isFreeRound ? 0 : round.entryFee,
      });

      toast({
        title: "Registration Created",
        description: isFreeRound
          ? "Free-entry registration completed."
          : "Please complete payment by scanning the QR and submit details below.",
      });
    } catch (error) {
      setStatus("failed");
      console.error("Payment error:", error);
      toast({
        title: "Payment Error",
        description: "Failed to create registration.",
        variant: "destructive",
      });
    }
  };

  const handleRetry = () => {
    setStatus("pending");
  };

  return (
    <Layout showFooter={false}>
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {status === "pending" && (
            <div className="space-y-6">
              {!isFreeRound && (isReturnFromPayment || showDetailsForm) && (
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                  <CardHeader className="text-center">
                    <CardTitle className="text-xl">Submit Payment Details</CardTitle>
                    <CardDescription>
                      Enter the details from your UPI payment so admin can verify.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Payment ID</label>
                      <Input
                        placeholder="pay_XXXXXXXXXXXXXX"
                        value={paymentId}
                        onChange={(e) => setPaymentId(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">UPI ID Used</label>
                      <Input
                        placeholder="name@bank"
                        value={paymentUpiId}
                        onChange={(e) => setPaymentUpiId(e.target.value)}
                      />
                    </div>
                    <Button variant="hero" className="w-full" onClick={handleSubmitPaymentDetails}>
                      Submit Details
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* UPI Payment */}
              <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">{isFreeRound ? "Free Entry Round" : "Scan to Pay"}</CardTitle>
                  <CardDescription>
                    {isFreeRound
                      ? "No payment required. Create your registration instantly."
                      : "Scan this QR with any UPI app to complete payment."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isFreeRound && (
                    <div className="flex justify-center">
                      <img
                        src="/upi-qr-v3.jpeg"
                        alt="UPI QR"
                        className="h-60 w-60 rounded-lg border border-border bg-white p-2"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <Button
                    variant="hero"
                    size="lg"
                    className="w-full"
                    onClick={handlePayment}
                    disabled={!!registration}
                  >
                    {registration
                      ? "Registration Already Created"
                      : isFreeRound
                      ? "Create Free Registration"
                      : "I've Paid - Create Registration"}
                  </Button>
                </CardContent>
              </Card>

              {!isFreeRound && !isReturnFromPayment && !showDetailsForm && (
                <Button variant="outline" className="w-full" onClick={() => setShowDetailsForm(true)}>
                  I Already Paid - Submit Details
                </Button>
              )}
            </div>
          )}

          {status === "processing" && (
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardContent className="py-16 text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                <div>
                  <h3 className="text-xl font-semibold">Processing Payment</h3>
                  <p className="text-muted-foreground mt-1">Please wait while we confirm your payment...</p>
                </div>
              </CardContent>
            </Card>
          )}


          {status === "failed" && (
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardContent className="py-12 text-center space-y-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.5 }}
                  className="w-20 h-20 mx-auto rounded-full bg-destructive/20 flex items-center justify-center"
                >
                  <XCircle className="h-10 w-10 text-destructive" />
                </motion.div>
                <div>
                  <h3 className="text-2xl font-bold">Payment Failed</h3>
                  <p className="text-muted-foreground mt-2">
                    We couldn't process your payment. Please try again.
                  </p>
                </div>
                <div className="space-y-2">
                  <Button variant="hero" size="lg" className="w-full" onClick={handleRetry}>
                    Try Again
                  </Button>
                  <Link to="/dashboard" className="block">
                    <Button variant="ghost" size="lg" className="w-full">
                      Back to Dashboard
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}

