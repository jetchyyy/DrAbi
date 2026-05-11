export function openQueuePrint({
  queueNumber,
  patientName,
}: {
  queueNumber: string;
  scheduledAt: string;
  estimatedEnd: string;
  patientName?: string;
}) {
  const doc = `
  <html>
    <head>
      <title>Queue Ticket</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial; padding: 24px; }
        .ticket { width: 320px; border: 1px dashed #ddd; padding: 16px; }
        .title { font-weight: 800; font-size: 12px; color: #333; }
        .number { font-size: 28px; font-weight: 900; color: #111; margin: 12px 0; }
        .muted { color: #666; font-size: 12px; }
        .big { font-size: 14px; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="ticket">
        <div class="title">Your Number:</div>
        <div class="number">${queueNumber}</div>
        <div class="muted">${patientName ?? ""}</div>
        <hr />
        <p class="big">PLEASE BE SEATED.<br/>YOU WILL BE SERVED SHORTLY</p>
      </div>
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
  </html>
  `;

  const w = window.open("", "_blank", "width=420,height=640");
  if (!w) return;
  w.document.open();
  w.document.write(doc);
  w.document.close();
}

export default openQueuePrint;
