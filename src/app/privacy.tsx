import {
  PublicBullet,
  PublicSection,
  PublicSubheading,
  PublicText,
  PublicPage,
} from '@/components/site/PublicPage';

export default function PrivacyScreen() {
  return (
    <PublicPage
      title="Privacy Policy"
      date="Last updated: October 2026"
      lead="This policy explains what ATLAS collects, how it is used and the choices you have. ATLAS is operated by HM. Zain (the operator, we or us). Questions about your data can be sent to hafizmzain786@gmail.com.">
      <PublicSection title="Information we collect">
        <PublicSubheading>Account details</PublicSubheading>
        <PublicText>
          Your email address, display name, username and an optional profile
          photo.
        </PublicText>
        <PublicSubheading>Learning content</PublicSubheading>
        <PublicText>
          The courses, roadmaps, notes, quiz results, timer sessions and XP you
          create while using ATLAS.
        </PublicText>
        <PublicSubheading>Uploaded files</PublicSubheading>
        <PublicText>
          PDFs you upload to generate a quiz are read only for that request.
        </PublicText>
      </PublicSection>

      <PublicSection title="How we use your information">
        <PublicBullet>
          To run the service: show your roadmap, store your notes, score your
          quizzes and measure your progress.
        </PublicBullet>
        <PublicBullet>To authenticate you and keep your account secure.</PublicBullet>
        <PublicBullet>To respond to messages you send us.</PublicBullet>
        <PublicBullet>
          We do not sell your data, and we do not use your learning content for
          advertising.
        </PublicBullet>
      </PublicSection>

      <PublicSection title="Data deletion">
        <PublicBullet>
          PDFs you upload are deleted immediately after the quiz is generated.
          They are never stored.
        </PublicBullet>
        <PublicBullet>
          Deleting a course also removes its roadmap, topics and notes.
        </PublicBullet>
        <PublicBullet>
          You can request full deletion of your account and everything tied to
          it by emailing hafizmzain786@gmail.com. We remove your data after we
          confirm the request comes from the account owner.
        </PublicBullet>
      </PublicSection>

      <PublicSection title="Cookies">
        <PublicText>
          ATLAS uses only essential storage: cookies and local storage to keep
          you signed in and remember your session. There are no advertising
          cookies and no third-party tracking on the site.
        </PublicText>
      </PublicSection>

      <PublicSection title="Your rights">
        <PublicBullet>Request a copy of the data we hold about you.</PublicBullet>
        <PublicBullet>Correct data that is inaccurate or out of date.</PublicBullet>
        <PublicBullet>Request deletion of your account and associated data.</PublicBullet>
        <PublicBullet>
          Where applicable data-protection law grants you further rights, you
          can exercise them through the same address: hafizmzain786@gmail.com.
        </PublicBullet>
      </PublicSection>

      <PublicSection title="Questions">
        <PublicText>
          For anything about this policy or your data, email
          hafizmzain786@gmail.com and we will reply.
        </PublicText>
      </PublicSection>
    </PublicPage>
  );
}
