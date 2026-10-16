import { ScreenHeading, ScreenShell } from "../components/screen-shell";
import { InfoParagraph, InfoSection } from "../components/info-blocks";

export default function TermsScreen() {
  return (
    <ScreenShell title="Terms & Conditions" activeLabel="Terms & Conditions">
      <ScreenHeading
        eyebrow="Legal"
        title="Terms & Conditions"
        subtitle="Last updated: October 2026"
      />

      <InfoParagraph>
        These terms control your use of ATLAS. By creating an account or using
        the service you accept them. Questions can be sent to
        hafizmzain786@gmail.com.
      </InfoParagraph>

      <InfoSection title="Acceptance of Terms">
        <InfoParagraph>
          By accessing or using ATLAS, you agree to these terms and to our
          Privacy Policy. If you do not agree, do not use the service. You must
          be old enough to enter a binding agreement in your country to use
          ATLAS.
        </InfoParagraph>
      </InfoSection>

      <InfoSection title="Use of Service">
        <InfoParagraph>
          ATLAS is provided for personal learning use. You agree to use it
          lawfully, keep your login credentials secure, and take responsibility
          for the content you store in it.
        </InfoParagraph>
        <InfoParagraph>
          Accounts that abuse the service, such as spam, scraping or automated
          misuse of the AI features, may be suspended.
        </InfoParagraph>
      </InfoSection>

      <InfoSection title="Intellectual Property">
        <InfoParagraph>
          The ATLAS software, design, name and branding belong to us and are
          licensed to you for personal, non-commercial use. You may not resell,
          redistribute or reverse-engineer the service except where the law
          expressly permits it.
        </InfoParagraph>
        <InfoParagraph>
          Your content stays yours. Your notes and learning data remain yours
          at all times.
        </InfoParagraph>
      </InfoSection>

      <InfoSection title="Limitation of Liability">
        <InfoParagraph>
          ATLAS is provided “as is” without warranties of any kind. To the
          maximum extent permitted by law, we are not liable for indirect,
          incidental or consequential damages, or for loss arising from your
          use of the service or your inability to use it.
        </InfoParagraph>
        <InfoParagraph>
          ATLAS does not guarantee any learning, exam or career outcome. Your
          sole remedy is to stop using the service.
        </InfoParagraph>
      </InfoSection>

      <InfoSection title="Changes to Terms">
        <InfoParagraph>
          We may update these terms as the service evolves. The “last updated”
          date at the top reflects the current version, and continued use of
          ATLAS after a change means you accept the updated terms. If you do
          not agree with a change, stop using the service and close your
          account.
        </InfoParagraph>
      </InfoSection>

      <InfoSection title="Contact">
        <InfoParagraph>
          Questions about these terms can be sent to hafizmzain786@gmail.com.
        </InfoParagraph>
      </InfoSection>
    </ScreenShell>
  );
}
