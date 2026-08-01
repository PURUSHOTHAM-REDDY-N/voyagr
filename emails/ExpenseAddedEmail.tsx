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
  Hr,
} from "@react-email/components";
import React from "react";

const ExpenseAddedEmail = ({
  projectName,
  paidByName,
  purpose,
  totalAmount,
  shareAmount,
  currencySymbol,
  expenseLink,
}: {
  projectName: string;
  paidByName: string;
  purpose: string;
  totalAmount: number;
  shareAmount: number;
  currencySymbol: string;
  expenseLink: string;
}) => {
  const previewText = `${paidByName} added an expense in ${projectName}`;

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
                <b>{paidByName}</b> added a new expense in <b>{projectName}</b>
              </Text>
              <Text className="text-black text-[14px] leading-[24px]">
                {purpose} &mdash; {currencySymbol}
                {totalAmount.toFixed(2)}
              </Text>
              <Text className="text-black font-medium text-[16px] leading-[24px]">
                Your share: {currencySymbol}
                {shareAmount.toFixed(2)}
              </Text>
              <Button
                style={{ color: "white !important" }}
                className="bg-[#3b82f6] rounded text-[#ffffff]
                           text-[12px] font-semibold no-underline text-center p-3"
                href={expenseLink}
              >
                View Expense
              </Button>
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

export default ExpenseAddedEmail;
