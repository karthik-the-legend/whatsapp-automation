Meta WhatsApp webhook + Razorpay/Stripe webhook receivers.
Verifies signatures (X-Hub-Signature-256 for Meta, x-razorpay-signature
for Razorpay), acks fast, and pushes real work onto a BullMQ job in jobs/.
