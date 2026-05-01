export const personas = [
  {
    id: "conservative",
    name: "Conservative",
    tone: "Maximum caution",
    summary: "Ask before using sensitive details and prefer safer substitutes.",
    rules: [
      "I will ask before sharing personal, financial, health, travel, or account data.",
      "I will use placeholders and summaries whenever exact details are not required.",
      "I will block unnecessary third-party sharing by default.",
    ],
  },
  {
    id: "balanced",
    name: "Balanced",
    tone: "Recommended",
    summary: "Minimize exposed data while keeping tasks practical.",
    rules: [
      "I will share only the minimum details needed to complete your task.",
      "I will mask direct identifiers when a substitute can still work.",
      "I will ask for confirmation before higher-risk sharing.",
    ],
  },
  {
    id: "convenience",
    name: "Convenience-First",
    tone: "Faster tasks",
    summary: "Move quickly, but still flag clearly sensitive actions.",
    rules: [
      "I will proceed with routine low-risk task details.",
      "I will warn before sharing financial, health, identity, or precise location data.",
      "I will keep a receipt of what was shared, protected, substituted, or blocked.",
    ],
  },
];

const MOCK_RESPONSE_DELAY_MS = 450;
const USE_BACKEND = true;
const ENABLE_FALLBACK = true;
const API_BASE_URL = "http://localhost:8000";
let activeConversationId = null;
let activeConversationPersona = null;
let activeConversationStarted = false;

const sensitiveSignals = [
  "address",
  "bank",
  "card",
  "credit",
  "debit",
  "email",
  "health",
  "home",
  "id",
  "medical",
  "passport",
  "password",
  "payment",
  "phone",
  "ssn",
  "social security",
];

const externalActionSignals = [
  "agent",
  "airline",
  "amazon",
  "appointment",
  "book",
  "buy",
  "calendar",
  "checkout",
  "delivery",
  "flight",
  "hotel",
  "order",
  "pay",
  "purchase",
  "reserve",
  "schedule",
  "send",
  "shop",
  "submit",
  "ticket",
];

const confirmationSignals = [
  "bank",
  "card",
  "checkout",
  "credit",
  "debit",
  "finalize",
  "id",
  "login",
  "passport",
  "password",
  "pay",
  "payment",
  "purchase",
  "send my",
  "share my",
  "ssn",
  "submit",
  "use my card",
];

function waitForMockResponse() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, MOCK_RESPONSE_DELAY_MS);
  });
}

function normalizeMessage(message = "") {
  return message.toLowerCase();
}

function hasAnyTerm(message, terms) {
  const normalizedMessage = normalizeMessage(message);
  return terms.some((term) => normalizedMessage.includes(term));
}

function getSelectedPersona(persona) {
  return personas.find((item) => item.id === persona?.id) || personas[1];
}

function getBackendPersonaId(persona) {
  if (persona?.id === "convenience") return "convenience_first";
  if (persona === "convenience") return "convenience_first";
  if (typeof persona === "string") return persona;
  return persona?.id || "balanced";
}

function createConversationId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function getConversationId(conversationId) {
  activeConversationId = conversationId || activeConversationId || createConversationId();
  return activeConversationId;
}

function prepareConversation(persona, conversationId) {
  const backendPersona = getBackendPersonaId(persona);
  const personaChanged = activeConversationPersona !== backendPersona;
  const conversationChanged =
    Boolean(conversationId) && conversationId !== activeConversationId;

  if (conversationChanged || personaChanged) {
    activeConversationStarted = false;
  }

  activeConversationPersona = backendPersona;
  return getConversationId(conversationId);
}

async function postJson(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${path} request failed with ${response.status}`);
  }

  return response.json();
}

function inferTaskContext(message) {
  const normalized = normalizeMessage(message);
  const requiresExternalAction = hasAnyTerm(normalized, externalActionSignals);
  const mentionsSensitiveData = hasAnyTerm(normalized, sensitiveSignals);
  const requiresConfirmationData = hasAnyTerm(normalized, confirmationSignals);

  if (hasAnyTerm(normalized, ["flight", "airline", "airport", "ticket"])) {
    return {
      destination: "Travel provider",
      requiredData: ["Route", "Passenger count", "Timing preference"],
      sensitiveData: ["Legal name", "Payment method", "Passport or government ID"],
      protectedData: ["Passport or government ID", "Payment details", "Unrelated travel history"],
      alternative: "Search with route, passenger count, and a flexible travel window first.",
      blocked: ["Passport or government ID", "Payment details"],
      requiresExternalAction,
      mentionsSensitiveData: true,
      requiresConfirmationData,
    };
  }

  if (hasAnyTerm(normalized, ["hotel", "room", "stay", "reserve"])) {
    return {
      destination: "Hotel or booking provider",
      requiredData: ["City or area", "Stay dates", "Guest count"],
      sensitiveData: ["Name", "Payment method", "Exact address"],
      protectedData: ["Home address", "Saved payment credentials", "Government ID"],
      alternative: "Search by city or neighborhood and hold payment details until checkout.",
      blocked: ["Saved payment credentials", "Government ID"],
      requiresExternalAction,
      mentionsSensitiveData: true,
      requiresConfirmationData,
    };
  }

  if (hasAnyTerm(normalized, ["buy", "order", "shop", "shopping", "purchase", "checkout"])) {
    return {
      destination: "Retailer or marketplace",
      requiredData: ["Item", "Quantity", "Preferences"],
      sensitiveData: ["Payment method", "Shipping address", "Account details"],
      protectedData: ["Account password", "Saved cards not selected", "Unrelated purchase history"],
      alternative: "Prepare the cart using product preferences and use delivery area instead of full address.",
      blocked: ["Account password", "Unrelated purchase history"],
      requiresExternalAction,
      mentionsSensitiveData: true,
      requiresConfirmationData,
    };
  }

  if (hasAnyTerm(normalized, ["calendar", "appointment", "meeting", "schedule"])) {
    return {
      destination: "Calendar or scheduling provider",
      requiredData: ["Event title", "Preferred time", "Duration"],
      sensitiveData: ["Full calendar details", "Private notes", "Unrelated attendees"],
      protectedData: ["Existing event titles", "Private notes", "Unrelated calendar locations"],
      alternative: "Use free/busy windows instead of exposing full calendar details.",
      blocked: ["Private notes", "Unrelated calendar content"],
      requiresExternalAction,
      mentionsSensitiveData,
      requiresConfirmationData,
    };
  }

  if (hasAnyTerm(normalized, ["email", "message", "send", "contact"])) {
    return {
      destination: "Message recipient or communication service",
      requiredData: ["Message content", "Recipient"],
      sensitiveData: ["Email address", "Phone number", "Private context"],
      protectedData: ["Unrelated contacts", "Private account data", "Precise location"],
      alternative: "Draft the message in chat and let you send it manually.",
      blocked: ["Unrelated contacts", "Private account data"],
      requiresExternalAction,
      mentionsSensitiveData,
      requiresConfirmationData,
    };
  }

  return {
    destination: requiresExternalAction ? "Requested external service" : "None",
    requiredData: ["User-provided task details"],
    sensitiveData: mentionsSensitiveData
      ? ["Sensitive details mentioned in the task"]
      : ["No sensitive data required"],
    protectedData: ["Personal identifiers", "Account data", "Payment data", "Precise location"],
    alternative: requiresExternalAction
      ? "Continue with only the minimum task details and avoid sensitive fields."
      : null,
    blocked: ["Unnecessary personal details", "Unneeded third-party sharing"],
    requiresExternalAction,
    mentionsSensitiveData,
    requiresConfirmationData,
  };
}

function personaRequiresConfirmation(persona, context) {
  if (context.requiresConfirmationData) return true;
  if (persona.id === "conservative") {
    return context.requiresExternalAction && context.mentionsSensitiveData;
  }
  if (persona.id === "balanced") {
    return context.requiresExternalAction && context.mentionsSensitiveData && !context.alternative;
  }
  return context.requiresExternalAction && context.requiresConfirmationData;
}

function canUseSaferAlternative(persona, context) {
  if (!context.alternative) return false;
  if (context.requiresConfirmationData) return false;
  if (persona.id === "convenience" && !context.mentionsSensitiveData) return false;
  return context.requiresExternalAction || context.mentionsSensitiveData;
}

function createSummaryReceipt(task, protectedItems) {
  return {
    type: "summary",
    task,
    completed: true,
    shared: [],
    protected: protectedItems,
    blocked: [],
    substitutions: [],
    deleted_after_task: true,
  };
}

function createAlternativeReceipt(task, context) {
  return {
    type: "full",
    task,
    completed: true,
    shared: context.requiredData.map((data) => ({
      data,
      party: context.destination,
    })),
    protected: context.protectedData,
    blocked: context.blocked.map((data) => ({
      data,
      party: context.destination,
      reason: "Not required for the safer alternative.",
    })),
    substitutions: [
      {
        original: context.sensitiveData.join(", "),
        substitute: context.alternative,
      },
    ],
    deleted_after_task: true,
  };
}

function createFullReceipt({ task, confirmation }) {
  const thirdParty = confirmation?.third_party || "Approved third party";

  return {
    type: "full",
    task,
    completed: true,
    shared: (confirmation?.data_required || []).map((data) => ({
      data,
      party: thirdParty,
    })),
    protected: confirmation?.protected_data || [],
    blocked: (confirmation?.blocked_data || []).map((data) => ({
      data,
      party: thirdParty,
      reason: "Not required for the approved action.",
    })),
    substitutions: confirmation?.substitutions || [],
    deleted_after_task: true,
  };
}

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeDecision(decision = {}) {
  const blockedData = normalizeArray(decision.blocked_data);
  const substitutions = normalizeArray(decision.substitutions);
  const rawDecision = (decision.decision || "permit").toLowerCase();
  const decisionStatus = rawDecision === "blocked" ? "block" : rawDecision;

  return {
    action: decision.action || "Evaluate task",
    third_party: decision.third_party || null,
    decision: decisionStatus,
    reason: decision.reason || "Evaluated by the selected persona rules.",
    data_required: normalizeArray(decision.data_required),
    protected_data: normalizeArray(decision.protected_data || blockedData),
    confirmation_required: Boolean(
      decision.confirmation_required ?? decision.confirmation_needed
    ),
    substitute_with:
      decision.substitute_with ||
      substitutions
        .map((item) => `${item.original} -> ${item.substitute}`)
        .join(", ") ||
      null,
  };
}

function normalizeKanakSubtask(subtask = {}, index = 0) {
  return normalizeDecision({
    action: subtask.action || `Review requested subtask ${index + 1}`,
    third_party: subtask.third_party || null,
    decision: subtask.decision || "confirm",
    reason:
      subtask.reason ||
      "The chat backend requires confirmation before this subtask continues.",
    data_required: subtask.data_required,
    protected_data: subtask.protected_data,
    confirmation_required: true,
    substitute_with: subtask.substitute_with,
  });
}

function flattenSharedItems(shared = []) {
  return shared.flatMap((item) => {
    const party = item.party || item.third_party || "Approved third party";
    return normalizeArray(item.data).map((data) => ({
      data,
      party,
    }));
  });
}

function flattenSubstitutionItems(substitutions = []) {
  return substitutions.flatMap((item) => {
    const nested = normalizeArray(item.substitutions);
    if (nested.length) return nested;
    if (item.original || item.substitute) {
      return [
        {
          original: item.original,
          substitute: item.substitute,
        },
      ];
    }
    return [];
  });
}

function normalizeReceipt(rawReceipt, rawResponse = {}, originalTask = "") {
  if (!rawReceipt) return null;

  const summary = rawReceipt.summary || rawReceipt;
  const shared = flattenSharedItems(normalizeArray(summary.shared || summary.shared_data));
  const protectedItems = normalizeArray(summary.protected || summary.protected_data);
  const blocked = normalizeArray(summary.blocked).map((item) => ({
    data:
      typeof item === "string"
        ? item
        : item.data || item.action || item.third_party || "Blocked action",
    party:
      typeof item === "string"
        ? "Requested third party"
        : item.party || item.third_party || "Requested third party",
    reason:
      typeof item === "string"
        ? "Blocked by the selected persona rules."
        : item.reason || "Blocked by the selected persona rules.",
  }));
  const substitutions = flattenSubstitutionItems(normalizeArray(summary.substitutions));
  const confirmations = normalizeArray(summary.confirmations);
  const isSummary =
    !rawResponse.task_blocked &&
    shared.length === 0 &&
    blocked.length === 0 &&
    substitutions.length === 0 &&
    confirmations.length === 0;

  return {
    type: isSummary ? "summary" : "full",
    task: rawReceipt.task || rawResponse.task || originalTask,
    completed: !rawResponse.task_blocked && confirmations.length === 0,
    shared,
    protected: protectedItems,
    blocked,
    substitutions,
    deleted_after_task: true,
    plain_language_summary: rawReceipt.plain_language_summary,
  };
}

function normalizeKanakReceipt(rawReceipt, originalTask = "") {
  return normalizeReceipt(rawReceipt, {}, originalTask);
}

function normalizeKanakResponse(rawResponse = {}, originalTask = "") {
  if (rawResponse.type === "response") {
    return {
      assistant_message: rawResponse.message || "",
      decisions: normalizeArray(rawResponse.governor_summary?.decisions).map(normalizeDecision),
      confirmation: null,
      receipt: normalizeKanakReceipt(rawResponse.receipt, originalTask),
    };
  }

  if (rawResponse.type === "confirmation") {
    const subtasks = normalizeArray(rawResponse.subtasks);
    const firstSubtask = subtasks[0] || {};

    return {
      assistant_message: rawResponse.message || "",
      decisions: subtasks.map(normalizeKanakSubtask),
      confirmation: {
        required: true,
        title: "Confirmation Needed",
        message: rawResponse.confirmation_message || rawResponse.message || "",
        action: firstSubtask.action,
        third_party: firstSubtask.third_party,
        trusted: true,
        data_required: normalizeArray(firstSubtask.data_required),
        protected_data: [],
      },
      receipt: null,
    };
  }

  throw new Error("Kanak chat response was incomplete.");
}

function createConfirmation(rawResponse = {}, decisions = []) {
  const confirmationDecision =
    decisions.find((decision) => decision.confirmation_required) || decisions[0] || {};

  return {
    required: true,
    title: "Approve sensitive data sharing?",
    message:
      "PersonaGuard needs your approval because this action cannot continue safely without the listed sensitive data.",
    action: confirmationDecision.action || rawResponse.task || "Continue requested task",
    third_party: confirmationDecision.third_party,
    trusted: false,
    data_required: confirmationDecision.data_required || [],
    protected_data: confirmationDecision.protected_data || [],
    blocked_data: confirmationDecision.protected_data || [],
    substitutions: [],
  };
}

function messageFromGovernorResponse(rawResponse = {}) {
  const receiptSummary = rawResponse.receipt?.plain_language_summary;

  if (rawResponse.task_blocked) {
    return receiptSummary
      ? `The task was blocked by the selected persona rules. ${receiptSummary}`
      : "The task was blocked by the selected persona rules. No sensitive data was shared.";
  }

  if (rawResponse.confirmation_required) {
    return receiptSummary
      ? `The selected persona requires your confirmation before continuing. ${receiptSummary}`
      : "The selected persona requires your confirmation before continuing.";
  }

  return (
    receiptSummary ||
    "I analyzed the task and cross-checked it against your selected persona. This can continue under the selected privacy rules."
  );
}

function isValidGovernorResponse(rawResponse) {
  return (
    rawResponse &&
    typeof rawResponse === "object" &&
    Array.isArray(rawResponse.decisions) &&
    typeof rawResponse.confirmation_required === "boolean" &&
    typeof rawResponse.task_blocked === "boolean"
  );
}

function createBlockedReceiptFromDecisions(rawResponse = {}, decisions = [], originalTask = "") {
  const blockedDecisions = decisions.filter((decision) => decision.decision === "block");

  return {
    type: "full",
    task: rawResponse.task || originalTask,
    completed: false,
    shared: [],
    protected: [
      ...new Set(decisions.flatMap((decision) => decision.protected_data || [])),
    ],
    blocked: blockedDecisions.map((decision) => ({
      data: decision.action,
      party: decision.third_party || "Requested third party",
      reason: decision.reason || "Blocked by the selected persona rules.",
    })),
    substitutions: [],
    deleted_after_task: true,
    plain_language_summary:
      rawResponse.receipt?.plain_language_summary ||
      "The requested task was blocked before sensitive data was shared.",
  };
}

function normalizeGovernorResponse(rawResponse = {}, originalTask = "", persona) {
  if (!isValidGovernorResponse(rawResponse)) {
    console.warn("Governor response was incomplete; using mock response.", rawResponse);
    return mockSendChatMessage({
      message: originalTask,
      persona,
    });
  }

  const decisions = normalizeArray(rawResponse.decisions).map(normalizeDecision);
  const receipt =
    normalizeReceipt(rawResponse.receipt, rawResponse, originalTask) ||
    (rawResponse.task_blocked
      ? createBlockedReceiptFromDecisions(rawResponse, decisions, originalTask)
      : null);

  return {
    assistant_message: messageFromGovernorResponse(rawResponse),
    decisions,
    confirmation:
      rawResponse.task_blocked || rawResponse.confirmation_required !== true
        ? null
        : createConfirmation(rawResponse, decisions),
    receipt,
  };
}

function createSubtask(action, dataRequired, thirdParty) {
  return {
    action,
    data_required: dataRequired,
    third_party: thirdParty,
  };
}

function buildSubtasksFromMessage(message = "") {
  const normalized = normalizeMessage(message);

  if (hasAnyTerm(normalized, ["flight", "airline", "airport", "ticket"])) {
    return [
      createSubtask("Search flight options", ["Route", "Travel dates", "Passenger count"], "Google Flights"),
      createSubtask(
        "Compare booking platforms",
        ["Route", "Travel dates", "Budget"],
        "Kayak"
      ),
      createSubtask(
        "Complete booking",
        ["Legal name", "Contact information", "Payment method"],
        "Travel provider"
      ),
    ];
  }

  if (hasAnyTerm(normalized, ["hotel", "room", "stay", "reserve"])) {
    return [
      createSubtask(
        "Search hotel inventory",
        ["Destination", "Stay dates", "Guest count"],
        "Marriott or hotel provider"
      ),
      createSubtask(
        "Compare hotel platforms",
        ["Destination", "Stay dates", "Budget"],
        "Hotels.com"
      ),
      createSubtask(
        "Complete reservation",
        ["Legal name", "Contact information", "Payment method"],
        "Hotel provider"
      ),
    ];
  }

  if (hasAnyTerm(normalized, ["buy", "order", "shop", "shopping", "purchase", "checkout"])) {
    return [
      createSubtask("Search products", ["Product name", "Preferences", "Budget"], "Amazon"),
      createSubtask("Prepare order", ["Selected item", "Quantity", "Delivery preference"], "Amazon"),
      createSubtask("Complete payment", ["Payment method", "Billing details"], "Payment provider"),
    ];
  }

  if (hasAnyTerm(normalized, ["calendar", "appointment", "meeting", "schedule"])) {
    return [
      createSubtask("Create calendar event", ["Event title", "Time", "Duration"], "Google Calendar"),
      createSubtask("Sync reminder", ["Event title", "Reminder time"], "Google Calendar"),
    ];
  }

  return [
    createSubtask("Handle task inside PersonaGuard chat", ["Task details"], "None"),
  ];
}

async function evaluateWithGovernor(payload) {
  const backendRequest = {
    task: payload.message || "",
    persona: getBackendPersonaId(payload.persona),
    subtasks: buildSubtasksFromMessage(payload.message || ""),
  };

  const response = await fetch(`${API_BASE_URL}/governor/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(backendRequest),
  });

  if (!response.ok) {
    throw new Error(`Governor request failed with ${response.status}`);
  }

  return normalizeGovernorResponse(
    await response.json(),
    backendRequest.task,
    payload.persona
  );
}

async function sendKanakStartRequest(persona, conversationId) {
  return postJson("/api/start", {
    conversation_id: conversationId,
    persona: getBackendPersonaId(persona),
  });
}

async function ensureKanakConversationStarted(persona, conversationId) {
  const resolvedConversationId = prepareConversation(persona, conversationId);

  if (!activeConversationStarted) {
    await sendKanakStartRequest(persona, resolvedConversationId);
    activeConversationStarted = true;
  }

  return resolvedConversationId;
}

async function sendKanakMessageRequest(payload) {
  const conversationId = await ensureKanakConversationStarted(
    payload.persona,
    payload.conversation_id
  );

  const rawResponse = await postJson("/api/message", {
    conversation_id: conversationId,
    message: payload.message || "",
  });

  return normalizeKanakResponse(rawResponse, payload.message || "");
}

async function sendKanakConfirmationRequest(payload) {
  const rawResponse = await postJson("/api/confirm", {
    conversation_id: getConversationId(payload.conversation_id),
    confirmed: payload.confirmed ?? payload.choice === "yes",
  });

  return normalizeKanakResponse(rawResponse, payload.task || "");
}

function baseDecisions(context, persona) {
  return [
    {
      action: "Analyze task and required data",
      third_party: context.destination,
      decision: "permit",
      reason: `${persona.name} allows the task analysis using only the message you provided.`,
      data_required: context.requiredData,
      protected_data: [],
      confirmation_required: false,
      substitute_with: null,
    },
    {
      action: "Cross-check selected persona rules",
      third_party: "PersonaGuard",
      decision: "permit",
      reason: `${persona.name} rules were applied before any external action or sensitive sharing.`,
      data_required: [persona.name],
      protected_data: persona.rules,
      confirmation_required: false,
      substitute_with: null,
    },
  ];
}

function allowedResponse(message, persona, context) {
  return {
    assistant_message:
      "I analyzed the task and cross-checked it against your selected persona. This can continue without sensitive sharing or external approval.",
    decisions: [
      ...baseDecisions(context, persona),
      {
        action: "Continue safely",
        third_party: context.destination,
        decision: "permit",
        reason: "The task can proceed with low-risk data only.",
        data_required: context.requiredData,
        protected_data: context.protectedData,
        confirmation_required: false,
        substitute_with: null,
      },
      {
        action: "Block unnecessary sensitive data",
        third_party: context.destination,
        decision: "block",
        reason: "PersonaGuard does not need identifiers, account access, payment data, or precise location for this step.",
        data_required: [],
        protected_data: context.protectedData,
        confirmation_required: false,
        substitute_with: null,
      },
    ],
    confirmation: null,
    receipt: createSummaryReceipt(message, context.protectedData),
  };
}

function alternativeResponse(message, persona, context) {
  return {
    assistant_message: `I analyzed the task and found a safer path under ${persona.name}. I will continue with this alternative: ${context.alternative}`,
    decisions: [
      ...baseDecisions(context, persona),
      {
        action: "Use safer alternative",
        third_party: context.destination,
        decision: "substitute",
        reason: "The original path could expose sensitive or unnecessary data, but a lower-risk substitute can still move the task forward.",
        data_required: context.sensitiveData,
        protected_data: context.protectedData,
        confirmation_required: false,
        substitute_with: context.alternative,
      },
      {
        action: "Block unnecessary disclosure",
        third_party: context.destination,
        decision: "block",
        reason: "PersonaGuard blocks data that is not required for the safer alternative.",
        data_required: [],
        protected_data: context.blocked,
        confirmation_required: false,
        substitute_with: null,
      },
    ],
    confirmation: null,
    receipt: createAlternativeReceipt(message, context),
  };
}

function confirmationResponse(persona, context) {
  return {
    assistant_message:
      "I analyzed the task and cross-checked it against your selected persona. There is no safe alternative that can complete this action without sharing sensitive data, so I need your confirmation before continuing.",
    decisions: [
      ...baseDecisions(context, persona),
      {
        action: "Require confirmation before execution",
        third_party: context.destination,
        decision: "confirm",
        reason: `${persona.name} requires approval before this sensitive action can proceed.`,
        data_required: context.sensitiveData,
        protected_data: context.protectedData,
        confirmation_required: true,
        substitute_with: null,
      },
      {
        action: "Block execution until approved",
        third_party: context.destination,
        decision: "block",
        reason: "No sensitive data is shared unless you approve the confirmation card.",
        data_required: [],
        protected_data: context.protectedData,
        confirmation_required: true,
        substitute_with: null,
      },
    ],
    confirmation: {
      required: true,
      title: "Approve sensitive data sharing?",
      message:
        "PersonaGuard needs your approval because this action cannot continue safely without the listed sensitive data.",
      action: "Continue requested task",
      third_party: context.destination,
      trusted: false,
      data_required: context.sensitiveData,
      protected_data: context.protectedData,
      blocked_data: context.blocked,
      substitutions: [],
    },
    receipt: null,
  };
}

function responseForMessage(message, personaPayload) {
  const persona = getSelectedPersona(personaPayload);
  const context = inferTaskContext(message);

  if (canUseSaferAlternative(persona, context)) {
    return alternativeResponse(message, persona, context);
  }

  if (personaRequiresConfirmation(persona, context)) {
    return confirmationResponse(persona, context);
  }

  return allowedResponse(message, persona, context);
}

async function mockSendChatMessage(payload) {
  await waitForMockResponse();
  return responseForMessage(payload.message || "", payload.persona);
}

export async function startConversation(persona) {
  const conversationId = prepareConversation(persona);

  if (!USE_BACKEND) {
    await waitForMockResponse();
    return {
      status: "started",
      persona: getBackendPersonaId(persona),
      message: "Hi, I am ready to help with your selected privacy settings.",
      conversation_id: conversationId,
    };
  }

  try {
    const response = await sendKanakStartRequest(persona, conversationId);
    activeConversationStarted = true;

    return {
      ...response,
      conversation_id: conversationId,
    };
  } catch (error) {
    if (!ENABLE_FALLBACK) throw error;

    console.warn("Kanak start request failed; using mock start response.", error);
    return {
      status: "started",
      persona: getBackendPersonaId(persona),
      message: "Hi, I am ready to help with your selected privacy settings.",
      conversation_id: conversationId,
    };
  }
}

export async function sendChatMessage(payload) {
  if (!USE_BACKEND) {
    return mockSendChatMessage(payload);
  }

  try {
    return await sendKanakMessageRequest(payload);
  } catch (kanakError) {
    if (!ENABLE_FALLBACK) throw kanakError;

    console.warn("Kanak chat request failed; trying governor backend.", kanakError);
  }

  try {
    return await evaluateWithGovernor(payload);
  } catch (error) {
    if (!ENABLE_FALLBACK) throw error;

    console.warn("Governor backend request failed; using mock response.", error);
    return mockSendChatMessage(payload);
  }
}

export async function sendConfirmationChoice(payload) {
  if (USE_BACKEND && payload.choice !== "alternative") {
    try {
      return await sendKanakConfirmationRequest(payload);
    } catch (kanakError) {
      if (!ENABLE_FALLBACK) throw kanakError;

      console.warn("Kanak confirmation request failed; trying governor backend.", kanakError);
    }

    try {
      return await evaluateWithGovernor({
        message: payload.task || "",
        persona: payload.persona,
      });
    } catch (error) {
      if (!ENABLE_FALLBACK) throw error;

      console.warn("Governor backend request failed; using mock confirmation response.", error);
    }
  }

  await waitForMockResponse();

  if (payload.choice === "yes") {
    return {
      assistant_message:
        "Approved. I will continue execution using only the approved data and keep the rest protected.",
      confirmation: null,
      receipt: createFullReceipt(payload),
    };
  }

  if (payload.choice === "no") {
    return {
      assistant_message:
        "Cancelled. I did not share the sensitive data for this action.",
      confirmation: null,
      receipt: null,
    };
  }

  return {
    assistant_message:
      "Safer alternative: I can continue with lower-risk data only, avoid external services, or leave the sensitive step for you to complete manually.",
    confirmation: null,
    receipt: null,
  };
}
