import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
  // Webhook payload contains 'record' (new data) and 'old_record' (previous data)
  const { record, old_record, type } = await req.json();

  // Logic: Send email ONLY if status changed to 'confirmed'
  // Or if it's a new booking (INSERT) and already set to 'confirmed'
  if (record.booking_status !== "confirmed") {
    return new Response(
      JSON.stringify({ message: "Status not confirmed. No email sent." }),
      { status: 200 },
    );
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Odysys Medical <onboarding@resend.dev>", // Use your verified domain here
      to: record.patient_email,
      subject: "Booking Confirmed!",
      html: `
        <h2>Appointment Confirmed</h2>
        <p>Hi ${record.patient_name},</p>
        <p>Your booking details:</p>
        <ul>
          <li><strong>Date:</strong> ${record.appointment_date}</li>
          <li><strong>Doctor:</strong> ${record.doctor_name}</li>
        </ul>
        <p>See you at the clinic!</p>
      `,
    }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), { status: 200 });
});
