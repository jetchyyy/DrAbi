import { useEffect, useState } from "react";
import { Download, FileText, ImageDown } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";

import { Button } from "../../../components/ui/button";
import { Card, CardTitle } from "../../../components/ui/card";
import { formatCurrency, formatDateLabel } from "../../../lib/utils";
import type { BookingListItem } from "../../../lib/supabase-clinic";
import { buildBookingReceiptLookupUrl } from "../booking-receipt";

interface BookingReceiptCardProps {
  booking: BookingListItem;
}

function formatFeeLabel(feeType: BookingListItem["feeType"]) {
  if (feeType === "follow_up") return "Follow-up Fee";
  if (feeType === "consultation") return "Consultation Fee";
  return "Medical Service Fee";
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (
      currentLine &&
      context.measureText(candidate).width > maxWidth
    ) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }

    currentLine = candidate;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [text];
}

async function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load receipt QR image."));
    image.src = src;
  });
}

async function buildReceiptCanvas(booking: BookingListItem) {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 1680;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Receipt image export is not supported in this browser.");
  }

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#fff7ed");
  gradient.addColorStop(1, "#ffffff");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#ea580c";
  context.fillRect(0, 0, canvas.width, 28);

  context.fillStyle = "#0f172a";
  context.font = "700 54px Arial";
  context.fillText("Odyssey Clinic Booking Receipt", 84, 130);

  context.fillStyle = "#475569";
  context.font = "400 28px Arial";
  context.fillText("Present this receipt at cashier before proceeding to staff.", 84, 182);

  context.fillStyle = "#ffffff";
  context.strokeStyle = "#e2e8f0";
  context.lineWidth = 2;
  context.roundRect(64, 230, 1152, 1360, 36);
  context.fill();
  context.stroke();

  context.fillStyle = "#f8fafc";
  context.roundRect(94, 270, 564, 472, 28);
  context.fill();

  context.fillStyle = "#ffffff";
  context.strokeStyle = "#fdba74";
  context.lineWidth = 3;
  context.roundRect(732, 270, 390, 390, 36);
  context.fill();
  context.stroke();

  const qrSvg = await QRCode.toString(
    buildBookingReceiptLookupUrl(booking.receiptCode),
    {
      errorCorrectionLevel: "M",
      margin: 1,
      type: "svg",
      width: 320,
    },
  );
  const qrDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;
  const qrImage = await loadImage(qrDataUrl);
  context.drawImage(qrImage, 767, 305, 320, 320);

  context.fillStyle = "#94a3b8";
  context.font = "700 20px Arial";
  context.fillText("SCAN TO VERIFY", 833, 690);

  context.fillStyle = "#94a3b8";
  context.font = "700 20px Arial";
  context.fillText("BOOKING SUMMARY", 118, 320);

  context.fillStyle = "#0f172a";
  context.font = "700 36px Arial";
  context.fillText(booking.serviceName, 118, 382);

  context.fillStyle = "#475569";
  context.font = "600 28px Arial";
  context.fillText(booking.doctorName ?? "Clinic medical service", 118, 432);

  const summaryRows = [
    ["Preferred date", formatDateLabel(booking.preferredDate)],
    ["Preferred time", booking.preferredTime],
    ["Booking status", booking.status],
    [
      "Payment status",
      booking.paymentStatus === "paid" ? "Paid at cashier" : "Pending cashier payment",
    ],
    [
      "Charge",
      `${formatFeeLabel(booking.feeType)} - ${formatCurrency(booking.feeAmount)}`,
    ],
    ["Receipt code", booking.receiptCode],
  ] as const;

  let summaryY = 500;
  summaryRows.forEach(([label, value]) => {
    context.fillStyle = "#94a3b8";
    context.font = "700 18px Arial";
    context.fillText(label.toUpperCase(), 118, summaryY);

    context.fillStyle = "#0f172a";
    context.font = label === "Receipt code" ? "700 28px Courier New" : "600 28px Arial";
    context.fillText(value, 118, summaryY + 42);
    summaryY += 90;
  });

  context.fillStyle = "#94a3b8";
  context.font = "700 20px Arial";
  context.fillText("REASON / INTAKE NOTES", 94, 842);

  context.fillStyle = "#f8fafc";
  context.strokeStyle = "#e2e8f0";
  context.lineWidth = 2;
  context.roundRect(94, 874, 1032, 260, 28);
  context.fill();
  context.stroke();

  const noteText = booking.intakeNotes?.trim() || "No intake notes provided.";
  context.fillStyle = "#334155";
  context.font = "500 26px Arial";
  const wrappedNotes = wrapCanvasText(context, noteText, 956);
  wrappedNotes.slice(0, 6).forEach((line, index) => {
    context.fillText(line, 128, 930 + index * 40);
  });

  context.fillStyle = "#94a3b8";
  context.font = "700 20px Arial";
  context.fillText("PATIENT INSTRUCTIONS", 94, 1210);

  const instructions = [
    "1. Save this receipt to your device or keep it open in the portal.",
    "2. Present the QR code and receipt code at cashier for payment verification.",
    "3. Proceed to clinic staff after cashier confirmation.",
  ];

  context.fillStyle = "#0f172a";
  context.font = "500 28px Arial";
  instructions.forEach((line, index) => {
    context.fillText(line, 104, 1270 + index * 54);
  });

  context.fillStyle = "#64748b";
  context.font = "400 22px Arial";
  context.fillText(`Created ${new Date(booking.createdAt).toLocaleString("en-PH")}`, 94, 1530);

  return canvas;
}

async function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Unable to create the receipt image file."));
    }, "image/png");
  });
}

async function downloadOrShareBlob(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type || "image/png" });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({
      files: [file],
      title: "Booking receipt",
      text: "Booking receipt image",
    });
    return;
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  link.click();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}

function buildReceiptPrintDocument(receiptImageUrl: string, booking: BookingListItem) {
  const paymentLabel =
    booking.paymentStatus === "paid" ? "Paid at cashier" : "Pending cashier payment";
  const doctorLabel = booking.doctorName ?? "Clinic medical service";
  const noteLabel = booking.intakeNotes?.trim() || "No intake notes provided.";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Booking Receipt ${booking.receiptCode}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Arial, sans-serif;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 32px;
        background: #f8fafc;
        color: #0f172a;
      }
      .sheet {
        max-width: 860px;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-top: 10px solid #ea580c;
        border-radius: 24px;
        padding: 32px;
      }
      h1 {
        margin: 0;
        font-size: 28px;
      }
      p {
        margin: 8px 0 0;
        line-height: 1.5;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin-top: 24px;
      }
      .item {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 16px;
      }
      .label {
        margin: 0 0 6px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        color: #64748b;
        text-transform: uppercase;
      }
      .value {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
      .code {
        font-family: "Courier New", monospace;
      }
      .image-wrap {
        margin-top: 28px;
        text-align: center;
      }
      img {
        width: 100%;
        max-width: 680px;
        border: 1px solid #e2e8f0;
        border-radius: 20px;
      }
      .actions {
        margin-top: 20px;
        color: #475569;
        font-size: 14px;
      }
      @media print {
        body {
          background: #ffffff;
          padding: 0;
        }
        .sheet {
          border: none;
          border-radius: 0;
          max-width: none;
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <h1>Booking Receipt</h1>
      <p>Use your browser print dialog and choose <strong>Save as PDF</strong>.</p>
      <div class="grid">
        <section class="item">
          <p class="label">Service</p>
          <p class="value">${booking.serviceName}</p>
        </section>
        <section class="item">
          <p class="label">Doctor / Provider</p>
          <p class="value">${doctorLabel}</p>
        </section>
        <section class="item">
          <p class="label">Preferred date</p>
          <p class="value">${formatDateLabel(booking.preferredDate)}</p>
        </section>
        <section class="item">
          <p class="label">Preferred time</p>
          <p class="value">${booking.preferredTime}</p>
        </section>
        <section class="item">
          <p class="label">Charge</p>
          <p class="value">${formatFeeLabel(booking.feeType)} - ${formatCurrency(booking.feeAmount)}</p>
        </section>
        <section class="item">
          <p class="label">Payment status</p>
          <p class="value">${paymentLabel}</p>
        </section>
        <section class="item">
          <p class="label">Receipt code</p>
          <p class="value code">${booking.receiptCode}</p>
        </section>
        <section class="item">
          <p class="label">Notes</p>
          <p class="value">${noteLabel}</p>
        </section>
      </div>
      <div class="image-wrap">
        <img alt="Booking receipt preview" src="${receiptImageUrl}" />
      </div>
      <p class="actions">Present this receipt at cashier before proceeding to staff.</p>
    </main>
    <script>
      window.addEventListener("load", function () {
        window.print();
      });
    </script>
  </body>
</html>`;
}

export function BookingReceiptCard({ booking }: BookingReceiptCardProps) {
  const [svgMarkup, setSvgMarkup] = useState("");
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);

  useEffect(() => {
    let active = true;

    void QRCode.toString(buildBookingReceiptLookupUrl(booking.receiptCode), {
      errorCorrectionLevel: "M",
      margin: 1,
      type: "svg",
      width: 220,
    }).then((svg: string) => {
      if (active) {
        setSvgMarkup(svg);
      }
    });

    return () => {
      active = false;
    };
  }, [booking.receiptCode]);

  const handleSaveImage = async () => {
    try {
      setIsSavingImage(true);
      const canvas = await buildReceiptCanvas(booking);
      const blob = await canvasToBlob(canvas);
      await downloadOrShareBlob(blob, `${booking.receiptCode}.png`);
      toast.success("Booking receipt image is ready.");
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save the booking receipt image.",
      );
    } finally {
      setIsSavingImage(false);
    }
  };

  const handleSavePdf = async () => {
    try {
      setIsSavingPdf(true);
      const canvas = await buildReceiptCanvas(booking);
      const receiptImageUrl = canvas.toDataURL("image/png");
      const printWindow = window.open("", "_blank", "noopener,noreferrer");

      if (!printWindow) {
        throw new Error("Allow pop-ups to open the Save as PDF preview.");
      }

      printWindow.document.open();
      printWindow.document.write(
        buildReceiptPrintDocument(receiptImageUrl, booking),
      );
      printWindow.document.close();
      toast.success("Print preview opened. Choose Save as PDF to keep a copy.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to open the Save as PDF preview.",
      );
    } finally {
      setIsSavingPdf(false);
    }
  };

  return (
    <Card className="h-full">
      <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
        Booking Receipt
      </p>
      <CardTitle className="mt-2">Present this at cashier</CardTitle>
      <p className="mt-2 text-sm text-slate-500">
        Cashier and staff can scan this receipt QR to verify the booking and
        payment status before the patient proceeds.
      </p>
      <div className="mt-5 flex justify-center rounded-[28px] bg-slate-50 p-5">
        {svgMarkup ? (
          <div
            aria-label={`Receipt QR for ${booking.serviceName}`}
            className="size-[220px]"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : (
          <div className="flex size-[220px] items-center justify-center rounded-3xl bg-white text-sm text-slate-400">
            Generating QR...
          </div>
        )}
      </div>
      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Receipt code
          </p>
          <p className="mt-1 break-all font-mono font-semibold text-slate-950">
            {booking.receiptCode}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Charge
          </p>
          <p className="mt-1 font-semibold text-slate-950">
            {formatFeeLabel(booking.feeType)} -{" "}
            {formatCurrency(booking.feeAmount)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Payment status
          </p>
          <p className="mt-1 font-semibold text-slate-950">
            {booking.paymentStatus === "paid" ? "Paid" : "Pending Cashier"}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Button
          className="w-full gap-2"
          disabled={isSavingImage}
          onClick={() => void handleSaveImage()}
          type="button"
          variant="secondary"
        >
          {isSavingImage ? (
            "Preparing image..."
          ) : (
            <>
              <ImageDown className="size-4" />
              Save as Image
            </>
          )}
        </Button>
        <Button
          className="w-full gap-2"
          disabled={isSavingPdf}
          onClick={() => void handleSavePdf()}
          type="button"
        >
          {isSavingPdf ? (
            "Opening PDF..."
          ) : (
            <>
              <FileText className="size-4" />
              Save as PDF
            </>
          )}
        </Button>
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <Download className="size-3.5 text-orange-500" />
        Image export uses your device share or download flow when supported,
        including modern Android and iPhone browsers.
      </p>
    </Card>
  );
}
