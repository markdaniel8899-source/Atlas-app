import { ScreenHeading, ScreenShell } from "../components/screen-shell";
import {
  InfoBullets,
  InfoParagraph,
  InfoSection,
  InfoSubheading,
} from "../components/info-blocks";

export default function PrivacyScreen() {
  return (
    <ScreenShell title="Privacy Policy" activeLabel="Privacy Policy">
      <ScreenHeading
        eyebrow="Legal"
        title="Privacy Policy"
        subtitle="Last updated: October 2026"
      />

      <InfoParagraph>
        This policy explains what ATLAS collects, how it is used and the
        choices you have. ATLAS is operated by HM. Zain (“we”). Questions about
        your data can be sent to hafizmzain786@gmail.com.
      </InfoParagraph>

      <InfoSection title="Information we collect">
        <InfoSubheading>Account details</InfoSubheading>
        <InfoParagraph>
          Your email address, display name, username and an optional profile
          photo.
        </InfoParagraph>
        <InfoSubheading>Learning content</InfoSubheading>
        <InfoParagraph>
          The courses, roadmaps, notes, quiz results, timer sessions and XP you
          create while using ATLAS.
        </InfoParagraph>
        <InfoSubheading>Uploaded files</InfoSubheading>
        <InfoParagraph>
          PDFs you upload to generate a quiz are read only for that request.
        </InfoParagraph>
      </InfoSection>

      <InfoSection title="How we use your information">
        <InfoBullets
          items={[
            "To run the service: show your roadmap, store your notes, score your quizzes and measure your progress.",
            "To authenticate you and keep your account secure.",
            "To respond to messages you send us.",
            "We do not sell your data, and we do not use your learning content for advertising.",
          ]}
        />
      </InfoSection>

      <InfoSection title="Data deletion">
        <InfoBullets
          items={[
            "PDFs you upload are deleted immediately after the quiz is generated. They are never stored.",
            "Deleting a course also removes its roadmap, topics and notes.",
            "You can request full deletion of your account and everything tied to it by emailing hafizmzain786@gmail.com. We remove your data after we confirm the request comes from the account owner.",
          ]}
        />
      </InfoSection>

      <InfoSection title="Cookies and storage">
        <InfoParagraph>
          ATLAS uses only essential storage: cookies and local storage to keep
          you signed in and remember your session. There are no advertising
          cookies and no third-party tracking on the site or in the app.
        </InfoParagraph>
      </InfoSection>

      <InfoSection title="Your rights">
        <InfoBullets
          items={[
            "Request a copy of the data we hold about you.",
            "Correct data that is inaccurate or out of date.",
            "Request deletion of your account and associated data.",
            "Where applicable data-protection law grants you further rights, you can exercise them through the same address: hafizmzain786@gmail.com.",
          ]}
        />
      </InfoSection>

      <InfoSection title="Questions">
        <InfoParagraph>
          For anything about this policy or your data, email
          hafizmzain786@gmail.com and we will reply.
        </InfoParagraph>
      </InfoSection>
    </ScreenShell>
  );
}
