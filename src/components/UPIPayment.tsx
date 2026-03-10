import React from 'react';
import { AlertCircle, QrCode, Copy, Smartphone } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface UPIPaymentProps {
    upiId?: string;
    amount: number;
    recipientName?: string;
}

export const UPIPayment: React.FC<UPIPaymentProps> = ({
    upiId = 'rishiisagod@okhdfcbank',
    amount,
    recipientName = 'TypeHaki Arena'
}) => {
    // Generate UPI deep link for mobile
    // Format: upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&tn=NOTE
    const amountStr = Number.isFinite(amount) ? amount.toFixed(2) : String(amount);
    const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(recipientName)}&am=${amountStr}&cu=INR&tn=Contest%20Registration`;
    const qrUrl = "/upi-qr.png";
    const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    return (
        <div className="space-y-4 w-full">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <QrCode className="w-5 h-5" />
                        Pay with UPI
                    </CardTitle>
                    <CardDescription>
                        Fast and secure payment via UPI
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* UPI Info */}
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Pay ₹{amount} to <strong>{recipientName}</strong> using any UPI app
                        </AlertDescription>
                    </Alert>

                    {/* QR Code */}
                    <div className="flex flex-col items-center gap-3">
                        <img
                            src={qrUrl}
                            alt="UPI QR"
                            className="h-60 w-60 rounded-lg border border-border bg-white p-2"
                            loading="lazy"
                        />
                        <div className="text-xs text-muted-foreground text-center">
                            Scan this QR from any UPI app to pay instantly.
                        </div>
                    </div>

                    {/* UPI Deep Link Button (mobile) */}
                    {isMobile && (
                        <a
                            href={upiLink}
                            className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                            <Smartphone className="w-4 h-4 mr-2" />
                            Open in UPI App
                        </a>
                    )}

                    {/* Manual UPI ID */}
                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Or enter this UPI ID manually:
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 text-sm font-mono">
                                {upiId}
                            </code>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(upiId);
                                }}
                                className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-sm font-medium transition-colors"
                            >
                                <span className="inline-flex items-center gap-2">
                                    <Copy className="h-4 w-4" />
                                    Copy
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Supported Payment Apps */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                            Supported UPI Apps:
                        </p>
                        <ul className="grid grid-cols-2 gap-2 text-xs text-blue-800 dark:text-blue-200">
                            <li>✓ Google Pay</li>
                            <li>✓ PhonePe</li>
                            <li>✓ Amazon Pay</li>
                            <li>✓ WhatsApp Pay</li>
                            <li>✓ BHIM</li>
                            <li>✓ Paytm</li>
                            <li>✓ iMobile</li>
                            <li>✓ Other UPI Apps</li>
                        </ul>
                    </div>

                    {/* Benefits */}
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                            Why choose UPI?
                        </p>
                        <ul className="space-y-1 text-xs text-green-800 dark:text-green-200">
                            <li>✓ Instant payment confirmation</li>
                            <li>✓ No transaction fees</li>
                            <li>✓ Works on any bank account</li>
                            <li>✓ Secure and encrypted</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default UPIPayment;
