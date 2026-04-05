import nodemailer from 'nodemailer';

export interface SendResumeEmailOptions {
  to: string;
  name: string;
  fileBuffer: Buffer;
  filename: string;
  mimeType: string;
}

/**
 * Create the Nodemailer transporter from environment variables.
 * Supports any SMTP provider (Gmail, SendGrid, Mailgun, etc.).
 */
function createTransporter(): nodemailer.Transporter {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      'SMTP configuration incomplete. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.'
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

/**
 * Send the generated resume as an email attachment to the user.
 */
export async function sendResumeEmail(options: SendResumeEmailOptions): Promise<void> {
  const { to, name, fileBuffer, filename, mimeType } = options;

  const fromAddress = process.env.SMTP_FROM || `Resume Analyzer <${process.env.SMTP_USER}>`;

  const transporter = createTransporter();

  const mailOptions: nodemailer.SendMailOptions = {
    from: fromAddress,
    to,
    subject: 'Your Improved Resume from Resume Analyzer',
    text: `Hi ${name},\n\nPlease find your AI-improved resume attached. This resume has been optimized to better match your target job description.\n\nGood luck with your application!\n\n— The Resume Analyzer Team`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px; }
    .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin:0">Your Improved Resume</h2>
    </div>
    <div class="content">
      <p>Hi ${escapeHtml(name)},</p>
      <p>Please find your AI-improved resume attached to this email.</p>
      <p>Your resume has been optimized to better match your target job description, with improved keyword alignment and stronger experience framing to help you pass ATS screening.</p>
      <p>
        <strong>Tips for your application:</strong>
      </p>
      <ul>
        <li>Review the highlighted changes to understand what was improved</li>
        <li>Customize the resume further for each specific application</li>
        <li>Make sure all content is accurate and truthful</li>
      </ul>
      <p>Good luck with your job search!</p>
      <p>— The Resume Analyzer Team</p>
    </div>
    <div class="footer">
      <p>This email was sent because you requested your improved resume from Resume Analyzer.</p>
    </div>
  </div>
</body>
</html>`,
    attachments: [
      {
        filename,
        content: fileBuffer,
        contentType: mimeType,
      },
    ],
  };

  await transporter.sendMail(mailOptions);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
