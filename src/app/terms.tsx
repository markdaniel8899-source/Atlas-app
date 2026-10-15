import {
  PublicSection,
  PublicText,
  PublicPage,
} from '@/components/site/PublicPage';

export default function TermsScreen() {
  return (
    <PublicPage
      title="Terms & Conditions"
      date="Last updated: October 2026"
      lead="These terms control your use of ATLAS. By creating an account or using the service you accept them. Questions can be sent to hafizmzain786@gmail.com.">
      <PublicSection title="Acceptance of Terms">
        <PublicText>
          By accessing or using ATLAS, you agree to these terms and to our
          Privacy Policy. If you do not agree, do not use the service. You must
          be old enough to enter a binding agreement in your country to use
          ATLAS.
        </PublicText>
      </PublicSection>

      <PublicSection title="Use of Service">
        <PublicText>
          ATLAS is provided for personal learning use. You agree to use it
          lawfully, keep your login credentials secure, and take responsibility
          for the content you store in it.
        </PublicText>
        <PublicText>
          Accounts that abuse the service, such as spam, scraping or automated
          misuse of the AI features, may be suspended.
        </PublicText>
      </PublicSection>

      <PublicSection title="Intellectual Property">
        <PublicText>
          The ATLAS software, design, name and branding belong to us and are
          licensed to you for personal, non-commercial use. You may not resell,
          redistribute or reverse-engineer the service except where the law
          expressly permits it.
        </PublicText>
        <PublicText>
          Your content stays yours. Your notes and learning data remain yours at
          all times.
        </PublicText>
      </PublicSection>

      <PublicSection title="Limitation of Liability">
        <PublicText>
          ATLAS is provided as is, without warranties of any kind. To the
          maximum extent permitted by law, we are not liable for indirect,
          incidental or consequential damages, or for loss arising from your use
          of the service or your inability to use it.
        </PublicText>
        <PublicText>
          ATLAS does not guarantee any learning, exam or career outcome. Your
          sole remedy is to stop using the service.
        </PublicText>
      </PublicSection>

      <PublicSection title="Changes to Terms">
        <PublicText>
          We may update these terms as the service evolves. The last updated
          date at the top reflects the current version, and continued use of
          ATLAS after a change means you accept the updated terms. If you do not
          agree with a change, stop using the service and close your account.
        </PublicText>
      </PublicSection>

      <PublicSection title="Contact">
        <PublicText>
          Questions about these terms can be sent to hafizmzain786@gmail.com.
        </PublicText>
      </PublicSection>
    </PublicPage>
  );
}
