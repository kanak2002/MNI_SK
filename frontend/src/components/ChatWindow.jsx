import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Bot, LoaderCircle, Send, Shield, UserRound } from "lucide-react";
import ConfirmationCard from "./ConfirmationCard.jsx";
import PersonaBadge from "./PersonaBadge.jsx";
import PersonaCards from "./PersonaCards.jsx";
import PrivacyReceipt from "./PrivacyReceipt.jsx";
import { sendChatMessage, sendConfirmationChoice } from "../services/api.js";

const initialMessage = {
  id: "welcome",
  role: "assistant",
  type: "persona-picker",
  text: "Hi, I\u2019m PersonaGuard. Before we start, what\u2019s your privacy comfort level?",
};

const quickReplies = [
  {
    id: "start-task",
    label: "Start a task",
    response: "Great — tell me what you\u2019d like the agent to do.",
  },
  {
    id: "compare-personas",
    label: "Compare personas",
    response:
      "Conservative uses maximum caution and asks before sensitive sharing. Balanced is recommended because it minimizes exposed data while keeping tasks practical. Convenience-First moves faster, shares routine details more freely, and still flags high-risk actions.",
  },
  {
    id: "customize-rules",
    label: "Customize rules",
    response:
      "Customization will be available soon. For this demo, I\u2019ll continue with your selected persona.",
  },
];

quickReplies[0].response = "Great \u2014 tell me what you\u2019d like the agent to do.";

function DecisionList({ decisions = [] }) {
  if (!decisions.length) return null;

  const labels = {
    permit: "PERMIT",
    protect: "PROTECT",
    substitute: "SUBSTITUTE",
    confirm: "APPROVAL",
    block: "BLOCKED",
  };

  const formatList = (items = []) => (items.length ? items.join(", ") : "None");

  return (
    <section className="decision-list" aria-label="Privacy decisions">
      {decisions.map((item, index) => (
        <article className="decision-item" key={`${item.action}-${index}`}>
          <div className="decision-status" data-decision={item.decision}>
            {labels[item.decision] || item.decision}
          </div>
          <div>
            <h2>{item.action}</h2>
            <p>{item.reason}</p>
            <dl>
              {item.third_party && (
                <div>
                  <dt>Destination</dt>
                  <dd>{item.third_party}</dd>
                </div>
              )}
              {item.data_required?.length > 0 && (
                <div>
                  <dt>{item.decision === "permit" ? "Permitted action data" : "Needed data"}</dt>
                  <dd>{formatList(item.data_required)}</dd>
                </div>
              )}
              {item.protected_data?.length > 0 && (
                <div>
                  <dt>Protected data</dt>
                  <dd>{formatList(item.protected_data)}</dd>
                </div>
              )}
              {item.confirmation_required !== undefined && (
                <div>
                  <dt>Confirmation</dt>
                  <dd>{item.confirmation_required ? "Approval needed" : "No confirmation needed"}</dd>
                </div>
              )}
              {item.substitute_with && (
                <div>
                  <dt>Safer substitute</dt>
                  <dd>{item.substitute_with}</dd>
                </div>
              )}
            </dl>
          </div>
        </article>
      ))}
    </section>
  );
}

function TypingIndicator() {
  return (
    <div className="typing-indicator" role="status" aria-live="polite">
      <LoaderCircle size={16} aria-hidden="true" />
      <span>{"Analyzing privacy rules\u2026"}</span>
    </div>
  );
}

function MessageBubble({
  isConfirmationActive,
  message,
  selectedPersona,
  onSelectPersona,
  onConfirmationChoice,
  onQuickReply,
}) {
  const isUser = message.role === "user";

  return (
    <article className={`message-row ${isUser ? "from-user" : "from-assistant"}`}>
      <div className="avatar" aria-hidden="true">
        {isUser ? <UserRound size={18} /> : <Bot size={18} />}
      </div>
      <div className="message-stack">
        {message.text && <div className="message-bubble">{message.text}</div>}
        {message.type === "typing" && <TypingIndicator />}
        {message.type === "persona-picker" && !selectedPersona && (
          <PersonaCards
            disabled={Boolean(selectedPersona)}
            selectedId={selectedPersona?.id}
            onSelect={onSelectPersona}
          />
        )}
        {message.type === "quick-replies" && !message.used && (
          <div className="quick-reply-row" aria-label="Suggested next steps">
            {quickReplies.map((reply) => (
              <button
                className="quick-reply"
                key={reply.id}
                onClick={() => onQuickReply(message.id, reply)}
                type="button"
              >
                {reply.label}
              </button>
            ))}
          </div>
        )}
        {message.decisions && <DecisionList decisions={message.decisions} />}
        {message.type === "confirmation" && (
          <ConfirmationCard
            confirmation={message.confirmation}
            disabled={!isConfirmationActive}
            onChoice={onConfirmationChoice}
          />
        )}
        {message.type === "receipt" && <PrivacyReceipt receipt={message.receipt} />}
      </div>
    </article>
  );
}

export default function ChatWindow() {
  const [messages, setMessages] = useState([initialMessage]);
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const inputRef = useRef(null);
  const messageListRef = useRef(null);
  const bottomRef = useRef(null);

  const canSend = useMemo(
    () =>
      Boolean(
        selectedPersona &&
          inputValue.trim() &&
          !pendingConfirmation &&
          !isChecking &&
          !isConfirming
      ),
    [inputValue, isChecking, isConfirming, pendingConfirmation, selectedPersona]
  );

  function appendMessages(nextMessages) {
    setMessages((current) => [...current, ...nextMessages]);
  }

  function removeTypingMessage() {
    setMessages((current) => current.filter((message) => message.type !== "typing"));
  }

  function scrollToBottom(behavior = "smooth") {
    window.requestAnimationFrame(() => {
      const messageList = messageListRef.current;
      if (messageList) {
        messageList.scrollTo({
          top: messageList.scrollHeight,
          behavior,
        });
      }

      window.requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ block: "end", behavior });
      });
    });
  }

  useLayoutEffect(() => {
    scrollToBottom(messages.length === 1 ? "auto" : "smooth");
  }, [isChecking, messages, pendingConfirmation, selectedPersona]);

  function handleSelectPersona(persona) {
    if (selectedPersona) return;

    setSelectedPersona(persona);
    appendMessages([
      {
        id: `persona-${persona.id}`,
        role: "user",
        text: persona.name,
      },
      {
        id: `rules-${persona.id}`,
        role: "assistant",
        text: `You\u2019re set to ${persona.name}. In plain language: ${persona.rules.join(" ")}`,
      },
      {
        id: `quick-${persona.id}`,
        role: "assistant",
        type: "quick-replies",
        text: "You can type a task directly, or choose a quick next step.",
      },
    ]);

    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleQuickReply(messageId, reply) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, used: true } : message
      )
    );

    appendMessages([
      {
        id: `quick-user-${reply.id}-${Date.now()}`,
        role: "user",
        text: reply.label,
      },
      {
        id: `quick-response-${reply.id}-${Date.now()}`,
        role: "assistant",
        text: reply.response,
      },
    ]);

    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSend) return;

    const task = inputValue.trim();
    setInputValue("");
    setIsChecking(true);

    appendMessages([
      {
        id: `task-${Date.now()}`,
        role: "user",
        text: task,
      },
      {
        id: `typing-${Date.now()}`,
        role: "assistant",
        type: "typing",
      },
    ]);

    try {
      const response = await sendChatMessage({
        message: task,
        persona: selectedPersona,
      });
      removeTypingMessage();

      const responseMessages = [
        {
          id: `response-${Date.now()}`,
          role: "assistant",
          text: response.assistant_message,
          decisions: response.decisions,
        },
      ];

      if (response.confirmation?.required) {
        const confirmationState = {
          task,
          persona: selectedPersona,
          confirmation: response.confirmation,
          decisions: response.decisions,
        };

        setPendingConfirmation(confirmationState);
        responseMessages.push({
          id: `confirm-${Date.now()}`,
          role: "assistant",
          type: "confirmation",
          confirmation: response.confirmation,
        });
      }

      if (response.receipt) {
        responseMessages.push({
          id: `receipt-${Date.now()}`,
          role: "assistant",
          type: "receipt",
          receipt: response.receipt,
        });
      }

      appendMessages(responseMessages);
    } catch {
      removeTypingMessage();
      appendMessages([
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          text: "I could not finish the privacy check. No data was shared. Please try again.",
        },
      ]);
    } finally {
      setIsChecking(false);
    }
  }

  async function handleConfirmationChoice(choice) {
    if (!pendingConfirmation || isConfirming) return;

    const apiChoice =
      choice === "approve" ? "yes" : choice === "safer" ? "alternative" : "no";
    const label =
      choice === "approve"
        ? "Yes, proceed"
        : choice === "safer"
          ? "See safer alternative"
          : "No, cancel";

    setIsConfirming(true);

    try {
      const result = await sendConfirmationChoice({
        ...pendingConfirmation,
        choice: apiChoice,
      });

      setPendingConfirmation(null);
      appendMessages([
        {
          id: `choice-${Date.now()}`,
          role: "user",
          text: label,
        },
        {
          id: `choice-response-${Date.now()}`,
          role: "assistant",
          text: result.assistant_message,
        },
        ...(result.receipt
          ? [
              {
                id: `choice-receipt-${Date.now()}`,
                role: "assistant",
                type: "receipt",
                receipt: result.receipt,
              },
            ]
          : []),
      ]);

      window.requestAnimationFrame(() => inputRef.current?.focus());
    } finally {
      setIsConfirming(false);
    }
  }

  const placeholder = pendingConfirmation
    ? "Confirmation needed before continuing"
    : selectedPersona
      ? "Ask PersonaGuard to handle any task..."
      : "Choose a privacy comfort level first";

  return (
    <main className="app-shell">
      <section className="chat-panel" aria-label="PersonaGuard chatbot">
        <header className="chat-header">
          <div className="brand-mark" aria-hidden="true">
            <Shield size={21} />
          </div>
          <div className="brand-copy">
            <h1>PersonaGuard</h1>
            <p>Privacy-first task assistant</p>
          </div>
          <PersonaBadge persona={selectedPersona} />
        </header>

        <div className="message-list" ref={messageListRef} aria-live="polite">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              isConfirmationActive={
                message.type === "confirmation" &&
                pendingConfirmation?.confirmation === message.confirmation &&
                !isConfirming
              }
              message={message}
              selectedPersona={selectedPersona}
              onSelectPersona={handleSelectPersona}
              onConfirmationChoice={handleConfirmationChoice}
              onQuickReply={handleQuickReply}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder={placeholder}
            disabled={!selectedPersona || Boolean(pendingConfirmation) || isChecking || isConfirming}
            aria-label="Task message"
          />
          <button disabled={!canSend} type="submit" aria-label="Send task">
            <Send size={18} aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  );
}
