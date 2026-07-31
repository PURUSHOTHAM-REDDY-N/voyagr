import {
  Html,
  Preview,
  Tailwind,
  Body,
  Head,
  Container,
  Section,
  Text,
  Button,
  Link,
  Hr,
} from "@react-email/components";
import React from "react";

const InviteEmail = ({
  inviteLink,
  projectName,
}: {
  inviteLink: string;
  projectName: string;
}) => {
  const previewText = `You've been invited to join ${projectName} on Voyagr!`;

  const BASE_URL = process.env.HOSTING_URL ?? "https://travelplannerai.site";

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-[140px] mx-auto p-[20px]">
            <Section className="mt-[32px]">
              <Text className="text-[24px] font-bold text-[#3b82f6]">
                Voyagr
              </Text>
            </Section>
            <Section className="text-center mt-[32px] mb-[32px]">
              <Text className="text-black font-medium text-[14px] leading-[24px]">
                You&apos;ve been invited to join <b>{projectName}</b> Travel
                Plan on Voyagr
              </Text>
              <Button
                style={{ color: "white !important" }}
                className="bg-[#3b82f6] rounded text-[#ffffff]
                           text-[12px] font-semibold no-underline text-center p-3"
                href={inviteLink}
              >
                Join the Plan
              </Button>
              <Text className="text-black text-[14px] leading-[24px]">
                If you have recieved this invite in error, you may safely ignore
                this.
              </Text>
              <Text className="text-black font-medium text-[14px] leading-[24px]">
                <Link
                  href={BASE_URL}
                  target="_blank"
                  className="text-[#2754C5] underline"
                >
                  Get Started
                </Link>{" "}
                with Voyagr.
              </Text>
            </Section>
            <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
            <Text className="text-[#666666  ] text-[12px] leading-[24px] flex items-center text-center justify-center w-full">
              @ 2024 Voyagr. All rights reserved.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default InviteEmail;
