import {
  Bot,
  ChevronDown,
  Clock,
  MessageCircle,
  Phone,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useClinicSettingsData } from '../../hooks/use-clinic-data';
import { defaultClinicSettings } from '../../config/clinic';
import { cn } from '../../lib/utils';

/* ── Types ────────────────────────────────────────────────── */

type MessageRole = 'bot' | 'user';

interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: Date;
}

interface QuickReply {
  label: string;
  value: string;
}

/* ── Chatbot knowledge base ───────────────────────────────── */

const QUICK_REPLIES: QuickReply[] = [
  { label: 'Book an appointment', value: 'How do I book an appointment?' },
  { label: 'Clinic hours', value: 'What are your clinic hours?' },
  { label: 'Our location', value: 'Where is the clinic located?' },
  { label: 'Contact us', value: 'What is the contact number?' },
  { label: 'Our services', value: 'What services do you offer?' },
  { label: 'New patient', value: 'I am a new patient, how do I register?' },
];

function getBotResponse(
  input: string,
  clinicName: string,
  address: string,
  contactNumber: string,
  operatingHours: { day: string; open: string; close: string; enabled: boolean }[],
): { text: string; quickReplies?: QuickReply[] } {
  const q = input.toLowerCase().trim();

  /* Greetings */
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|greetings)\b/.test(q)) {
    return {
      text: `Welcome to **${clinicName}**. I am your virtual assistant and can help you with appointments, clinic hours, location, and more. What do you need today?`,
      quickReplies: QUICK_REPLIES.slice(0, 4),
    };
  }

  /* Booking */
  if (/book|appointment|schedul|reserv/.test(q)) {
    return {
      text: `To book an appointment, click **Book Appointment** in the navigation bar.\n\nYou can select your preferred service, doctor, date, and time. Our staff will review and confirm your request. You can monitor the status anytime under **My Bookings**.`,
      quickReplies: [
        { label: 'Track my bookings', value: 'How do I check my bookings?' },
        { label: 'Cancel a booking', value: 'How do I cancel my appointment?' },
        { label: 'Clinic hours', value: 'What are your clinic hours?' },
      ],
    };
  }

  /* Tracking bookings */
  if (/track|check.*booking|my booking|my appointment|status/.test(q)) {
    return {
      text: `Open **My Bookings** from the top navigation to view all your requests and their current status.\n\n- **Pending** — awaiting staff confirmation\n- **Confirmed** — your slot is reserved\n- **Cancelled** — the booking was not pushed through\n\nFor changes, contact the clinic directly.`,
      quickReplies: [
        { label: 'Cancel a booking', value: 'How do I cancel my appointment?' },
        { label: 'Contact us', value: 'What is the contact number?' },
      ],
    };
  }

  /* Cancellation */
  if (/cancel|reschedul/.test(q)) {
    return {
      text: `To cancel or reschedule, please call us directly at **${contactNumber}**.\n\nNote that cancellations must be requested at least **12 hours** before your scheduled appointment to avoid any inconvenience.`,
      quickReplies: [
        { label: 'Contact number', value: 'What is the contact number?' },
        { label: 'Book new slot', value: 'How do I book an appointment?' },
      ],
    };
  }

  /* Hours */
  if (/hour|open|close|timing|time.*open|when.*open/.test(q)) {
    const hoursText = operatingHours
      .map((h) => {
        if (!h.enabled) return `- **${h.day}**: Closed`;
        return `- **${h.day}**: ${formatTime(h.open)} — ${formatTime(h.close)}`;
      })
      .join('\n');
    return {
      text: `**Operating Hours**\n\n${hoursText}\n\nWalk-ins are welcome, though booking in advance is recommended to secure your preferred time.`,
      quickReplies: [
        { label: 'Book appointment', value: 'How do I book an appointment?' },
        { label: 'Our location', value: 'Where is the clinic located?' },
      ],
    };
  }

  /* Location */
  if (/location|address|where|direction|map|find you|find us/.test(q)) {
    return {
      text: `**Clinic Address**\n\n${address}\n\nParking is available nearby and we are accessible via public transit. Look for the clinic signage at the entrance.`,
      quickReplies: [
        { label: 'Clinic hours', value: 'What are your clinic hours?' },
        { label: 'Contact number', value: 'What is the contact number?' },
      ],
    };
  }

  /* Contact */
  if (/contact|phone|number|call|reach|get in touch/.test(q)) {
    return {
      text: `You can reach **${clinicName}** by phone at:\n\n**${contactNumber}**\n\nOur staff is available during operating hours to assist you with appointments, billing, and general inquiries.`,
      quickReplies: [
        { label: 'Clinic hours', value: 'What are your clinic hours?' },
        { label: 'Our location', value: 'Where is the clinic located?' },
      ],
    };
  }

  /* Services */
  if (/service|specialty|specialt|offer|provide|treatment|procedure/.test(q)) {
    return {
      text: `**${clinicName}** offers a range of healthcare services, including:\n\n- General Medicine and Family Practice\n- Pediatrics\n- Internal Medicine\n- Obstetrics and Gynecology\n- General Surgery\n- Laboratory and Diagnostics\n- Teleconsultation\n\nVisit the **Book Appointment** page to see all available services and their fees.`,
      quickReplies: [
        { label: 'Book appointment', value: 'How do I book an appointment?' },
        { label: 'Teleconsultation', value: 'How does teleconsultation work?' },
      ],
    };
  }

  /* Teleconsult */
  if (/teleconsult|online consult|virtual|video|remote/.test(q)) {
    return {
      text: `**Teleconsultation** lets you consult with our doctors remotely from any device.\n\nHow it works:\n1. Book a teleconsultation appointment\n2. Staff sends you a secure room link once confirmed\n3. Join at your scheduled time from **My Bookings**\n\nA device with a working camera and microphone is all you need. No additional software required.`,
      quickReplies: [
        { label: 'Book teleconsult', value: 'How do I book an appointment?' },
        { label: 'My bookings', value: 'How do I check my bookings?' },
      ],
    };
  }

  /* Registration / new patient */
  if (/new patient|register|sign up|create account|first time/.test(q)) {
    return {
      text: `**Getting started as a new patient:**\n\n1. Go to the portal login page and click **Sign Up**\n2. Fill in your personal details\n3. Verify your email address\n4. Log in and book your first appointment\n\nYour patient record is added to the clinic registry right after sign-up and stays tagged as not yet visited until your first clinic visit.`,
      quickReplies: [
        { label: 'Book first appointment', value: 'How do I book an appointment?' },
        { label: 'Contact us', value: 'What is the contact number?' },
      ],
    };
  }

  /* Insurance / HMO */
  if (/insurance|hmo|philhealth|pagibig|sss/.test(q)) {
    return {
      text: `For details about accepted HMO plans, PhilHealth coverage, and payment options, please contact us at **${contactNumber}**.\n\nOur staff will be happy to clarify what is covered for your specific needs.`,
      quickReplies: [
        { label: 'Contact number', value: 'What is the contact number?' },
      ],
    };
  }

  /* Emergency */
  if (/emergency|urgent|serious|critical|emer/.test(q)) {
    return {
      text: `**For medical emergencies, please call 911 or proceed to the nearest emergency room immediately.**\n\nFor urgent but non-emergency concerns, contact us at **${contactNumber}** during operating hours.`,
    };
  }

  /* Thanks */
  if (/thank|thanks|thank you|ty|great|awesome|perfect/.test(q)) {
    return {
      text: `You are welcome. Is there anything else I can help you with?`,
      quickReplies: QUICK_REPLIES.slice(0, 3),
    };
  }

  /* Goodbye */
  if (/bye|goodbye|see you|take care/.test(q)) {
    return {
      text: `Thank you for reaching out. We look forward to seeing you at **${clinicName}**. Take care and stay well.`,
    };
  }

  /* Fallback */
  return {
    text: `I did not quite catch that. I can help you with:\n\n- Booking or checking appointments\n- Clinic hours and location\n- Contact information\n- Available services\n\nFeel free to ask, or call us at **${contactNumber}**.`,
    quickReplies: QUICK_REPLIES.slice(0, 4),
  };
}

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatMessageTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ── Markdown-lite renderer ───────────────────────────────── */

function renderText(text: string) {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={j}>{part.slice(2, -2)}</strong>
          ) : (
            <span key={j}>{part}</span>
          ),
        )}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    );
  });
}

/* ── Component ────────────────────────────────────────────── */

export function PortalChatbot() {
  const { data: clinic = defaultClinicSettings } = useClinicSettingsData();

  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasUnread, setHasUnread] = useState(true);
  const [currentQuickReplies, setCurrentQuickReplies] = useState<QuickReply[]>(QUICK_REPLIES.slice(0, 4));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Initial greeting */
  useEffect(() => {
    setMessages([
      {
        id: 'init',
        role: 'bot',
        text: `Hello! I am the virtual assistant for **${clinic.clinicName}**. How can I help you today?`,
        timestamp: new Date(),
      },
    ]);
  }, [clinic.clinicName]);

  /* Auto-scroll */
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isTyping]);

  /* Focus input on open */
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
      setHasUnread(false);
    }
  }, [isOpen]);

  function sendMessage(text: string) {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setCurrentQuickReplies([]);
    setIsTyping(true);

    const delay = 800 + Math.random() * 700;
    setTimeout(() => {
      const response = getBotResponse(
        text,
        clinic.clinicName,
        clinic.address,
        clinic.contactNumber,
        clinic.operatingHours,
      );
      const botMsg: ChatMessage = {
        id: `b-${Date.now()}`,
        role: 'bot',
        text: response.text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
      if (response.quickReplies) setCurrentQuickReplies(response.quickReplies);
      if (!isOpen) setHasUnread(true);
    }, delay);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  }

  return (
    <>
      {/* ── Chat window ─────────────────────────────────────── */}
      <div
        className={cn(
          'fixed bottom-[84px] right-5 z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 ease-out',
          'w-[340px] sm:w-[360px]',
          isOpen
            ? 'max-h-[520px] opacity-100 translate-y-0 pointer-events-auto'
            : 'max-h-0 opacity-0 translate-y-4 pointer-events-none',
        )}
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(234,88,12,0.10)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-orange-600 to-orange-500 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20">
              <Bot className="size-4 text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border-2 border-orange-500 bg-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white leading-tight">Virtual Assistant</p>
              <p className="text-[10px] text-orange-100">{clinic.clinicName}</p>
            </div>
          </div>
          <button
            className="flex size-7 items-center justify-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white"
            onClick={() => setIsOpen(false)}
            aria-label="Close chat"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>

        {/* Info bar */}
        <div className="flex items-center gap-4 border-b border-slate-100 bg-orange-50/70 px-4 py-1.5 text-[10px] font-medium text-slate-500">
          <span className="flex items-center gap-1">
            <Clock className="size-3 text-orange-400" />
            {clinic.operatingHours.find((h) => h.enabled)
              ? `${formatTime(clinic.operatingHours[0].open)} — ${formatTime(clinic.operatingHours[0].close)}`
              : 'Hours vary'}
          </span>
          <span className="flex items-center gap-1">
            <Phone className="size-3 text-orange-400" />
            {clinic.contactNumber}
          </span>
        </div>

        {/* Messages */}
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3 chatbot-messages" style={{ minHeight: 0, maxHeight: 300 }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex items-end gap-1.5',
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row',
              )}
            >
              {msg.role === 'bot' && (
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-100">
                  <Bot className="size-3 text-orange-600" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[82%] px-3 py-2 text-[12.5px] leading-relaxed',
                  msg.role === 'bot'
                    ? 'rounded-2xl rounded-bl-sm bg-slate-100 text-slate-800'
                    : 'rounded-2xl rounded-br-sm bg-orange-600 text-white',
                )}
              >
                <p className="whitespace-pre-wrap">{renderText(msg.text)}</p>
                <p
                  className={cn(
                    'mt-0.5 text-[9px]',
                    msg.role === 'bot' ? 'text-slate-400' : 'text-orange-200',
                  )}
                >
                  {formatMessageTime(msg.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex items-end gap-1.5">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-100">
                <Bot className="size-3 text-orange-600" />
              </div>
              <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2.5">
                <div className="flex gap-1">
                  <span className="typing-dot" />
                  <span className="typing-dot delay-150" />
                  <span className="typing-dot delay-300" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick replies */}
        {currentQuickReplies.length > 0 && !isTyping && (
          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 bg-white px-3 py-2">
            {currentQuickReplies.map((qr) => (
              <button
                key={qr.value}
                className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-semibold text-orange-700 transition hover:bg-orange-100 hover:border-orange-400 active:scale-95"
                onClick={() => sendMessage(qr.value)}
              >
                {qr.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-slate-100 bg-white px-3 py-2.5">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 pl-4 pr-1.5 py-1.5 transition focus-within:border-orange-400 focus-within:bg-white">
            <input
              ref={inputRef}
              className="flex-1 bg-transparent text-[13px] text-slate-800 outline-none placeholder:text-slate-400"
              disabled={isTyping}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              type="text"
              value={inputValue}
            />
            <button
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full transition',
                inputValue.trim() && !isTyping
                  ? 'bg-orange-600 text-white hover:bg-orange-700 active:scale-90'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed',
              )}
              disabled={!inputValue.trim() || isTyping}
              onClick={() => sendMessage(inputValue)}
              aria-label="Send message"
            >
              <Send className="size-3" />
            </button>
          </div>
          <p className="mt-1 text-center text-[9px] text-slate-400 tracking-wide">
            {clinic.clinicName} Virtual Assistant
          </p>
        </div>
      </div>

      {/* ── FAB trigger ─────────────────────────────────────── */}
      <button
        className={cn(
          'fixed bottom-5 right-5 z-50 flex size-13 items-center justify-center rounded-full shadow-lg transition-all duration-300',
          'bg-orange-600 text-white hover:bg-orange-700 active:scale-95',
        )}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        style={{ width: 52, height: 52, boxShadow: '0 4px 20px rgba(234,88,12,0.45)' }}
      >
        {isOpen ? (
          <X className="size-5 transition-transform duration-200" />
        ) : (
          <>
            <MessageCircle className="size-5 transition-transform duration-200" />
            {hasUnread && (
              <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-white ring-2 ring-white">
                1
              </span>
            )}
          </>
        )}
      </button>

      {/* Tooltip on first load */}
      {!isOpen && hasUnread && (
        <div className="fixed bottom-[68px] right-[68px] z-50 hidden sm:block animate-fade-in">
          <div className="relative rounded-xl border border-orange-200 bg-white px-3 py-1.5 shadow-md">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
              <Sparkles className="size-3 text-orange-500" />
              How can I help you?
            </p>
            <div className="absolute -bottom-1.5 right-3 size-3 rotate-45 border-b border-r border-orange-200 bg-white" />
          </div>
        </div>
      )}
    </>
  );
}
