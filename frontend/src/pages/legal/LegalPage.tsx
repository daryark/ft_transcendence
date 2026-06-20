import BackButton from "../../components/BackButton/BackButton";
import "./LegalPage.scss";

type LegalSection = {
  heading: string;
  body: string[];
};

type LegalPageContent = {
  eyebrow: string;
  title: string;
  lastUpdated: string;
  lead: string;
  sections: LegalSection[];
};

const privacyPolicy: LegalPageContent = {
  eyebrow: "Privacy Policy",
  title: "Privacy Policy",
  lastUpdated: "June 20, 2026",
  lead:
    "This policy explains what data Tetra uses to run accounts, gameplay, social features, leaderboards, and security for this student project.",
  sections: [
    {
      heading: "Information we collect",
      body: [
        "Account data such as username, email address, password hash, avatar choice, authentication provider identifiers, and account creation date.",
        "Gameplay and profile data such as match history, room activity, scores, ranks, achievements, statistics, friends, blocked users, messages, and notifications.",
        "Technical data such as session tokens, socket connection state, request metadata, and IP-related information needed for security and abuse prevention.",
      ],
    },
    {
      heading: "How we use information",
      body: [
        "We use this data to authenticate users, keep sessions active, run multiplayer games, show profiles and leaderboards, deliver notifications, and protect the service from misuse.",
        "Anonymous sessions can play without a registered account, but gameplay state still needs temporary identifiers while the session is active.",
      ],
    },
    {
      heading: "Storage and retention",
      body: [
        "Account and gameplay records are stored in the project database for as long as the account exists or as long as the project needs them for core functionality.",
        "Users can request account deletion or data anonymization from the project maintainers when this is required by the evaluation subject.",
      ],
    },
    {
      heading: "Third-party login",
      body: [
        "If you sign in with GitHub, Tetra receives only the information needed to create or connect your account. GitHub handles its own authentication flow under GitHub's policies.",
      ],
    },
    {
      heading: "Security",
      body: [
        "Passwords are not stored in plain text, authenticated requests use session tokens, and access to protected game and social features is checked before use.",
        "No project can promise perfect security, but the application is designed to limit access to personal data to the features that need it.",
      ],
    },
    {
      heading: "Contact",
      body: [
        "For privacy questions, corrections, deletion, or anonymization requests, contact the maintainers of this Tetra project repository.",
      ],
    },
  ],
};

const termsOfService: LegalPageContent = {
  eyebrow: "Terms of Service",
  title: "Terms of Service",
  lastUpdated: "June 20, 2026",
  lead:
    "These terms describe the basic rules for using Tetra accounts, gameplay, rooms, chat, profiles, and competitive features.",
  sections: [
    {
      heading: "Use of the service",
      body: [
        "Tetra is provided as a student project for learning, demonstration, and evaluation. You may use it only in ways that do not disrupt the service or other players.",
        "You are responsible for the activity that happens through your account or anonymous session.",
      ],
    },
    {
      heading: "Accounts",
      body: [
        "Use accurate account information, keep your credentials private, and do not attempt to access another user's account.",
        "The project may suspend or remove accounts that abuse gameplay, social features, authentication, or platform security.",
      ],
    },
    {
      heading: "Fair play and conduct",
      body: [
        "Do not cheat, exploit bugs, automate gameplay, spam messages, harass users, impersonate others, or upload content that is illegal or harmful.",
        "Leaderboards, ranks, achievements, and match records may be corrected or removed when they are affected by bugs, cheating, or test data.",
      ],
    },
    {
      heading: "User content",
      body: [
        "Messages, usernames, avatars, profile information, and room activity must stay respectful and appropriate for the project environment.",
        "By adding content to Tetra, you allow the project to display it where the related feature requires it, such as chat, profiles, notifications, and leaderboards.",
      ],
    },
    {
      heading: "Availability",
      body: [
        "The service may be changed, restarted, unavailable, or reset during development, testing, deployment, or evaluation.",
        "Tetra is provided without warranties and is not intended for commercial or production use.",
      ],
    },
    {
      heading: "Privacy",
      body: [
        "Use of Tetra is also covered by the Privacy Policy, which explains what data is collected and how it is used for project functionality.",
      ],
    },
  ],
};

function LegalPage({ content }: { content: LegalPageContent }) {
  return (
    <main className="legal-page">
      <BackButton />
      <section className="legal-page__hero">
        <p className="legal-page__eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p className="legal-page__updated">
          Last updated: {content.lastUpdated}
        </p>
        <p className="legal-page__lead">{content.lead}</p>
      </section>

      <div className="legal-page__content">
        {content.sections.map((section) => (
          <section className="legal-page__section" key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}

export function PrivacyPolicyPage() {
  return <LegalPage content={privacyPolicy} />;
}

export function TermsOfServicePage() {
  return <LegalPage content={termsOfService} />;
}
