type VerificationEmailInput = {
  to: string
  name: string
  verifyUrl: string
}

export async function sendVerificationEmail(input: VerificationEmailInput): Promise<void> {
  console.info('[emailVerification] SMTP disabled. Verification link:', {
    to: input.to,
    name: input.name,
    verifyUrl: input.verifyUrl,
  })
}
