# Mobile SMS confirmation contract

Inspected on 2026-10-01. No SMS or verification mutation was executed during this investigation.

## Exact operation

```graphql
mutation MobileVerifyOtp($input: VerifyRegisterOtpInput!) {
  verifyRegisterOtp(input: $input)
}
```

The live schema and server resolver agree: the return type is `Boolean!`.
Input fields are `phone: String!` and `code: String!`. Server validation requires
the phone in `+998` plus nine digits format and the code length to be five.
Mobile stores a normalized phone from the preceding phone step, validates the
code with `/^\d{5}$/`, and sends `{ input: { phone: pending.phone, code } }`.
No other field is required by this mutation. Values are intentionally omitted.

Expected success response:

```json
{"data":{"verifyRegisterOtp":true}}
```

## Authentication stages

This operation verifies registration eligibility. It does not return tokens or
create a user. Mobile checks for `true`, marks its pending registration verified,
and opens the personal-details form at `/auth/register`.

The final `register(input: RegisterInput!): AuthPayload!` call requires phone,
first name, last name, and password. Email and address are optional. It returns
`accessToken`, `refreshToken`, and `user`; mobile then writes the token pair to
its SecureStore session record and updates the authenticated state.

Existing-account `login(input: LoginInput!): AuthPayload!` expects `identifier`
and `password`. The inspected live schema has no passwordless phone/SMS login
mutation. Its legacy `verifyEmail` uses an email and a different stored
verification challenge; it cannot substitute for registration OTP confirmation.

## Findings and remaining evidence

No mutation name, input field, code type, or response-shape mismatch was found
for mobile registration OTP confirmation. Its document passes validation against
the live schema. Expecting a logged-in session immediately from this Boolean
response conflicts with the existing API workflow.

The exact cause of the user's reported code-submission rejection remains
unconfirmed without its current error/status or post-confirmation screen.
GraphQL errors are thrown by the transport and mapped to a localized OTP error;
they are not converted into an empty result. Raw server messages and credentials
are omitted from diagnostics. Token storage is not invoked at this OTP stage.

The smallest supported action is to preserve the existing verification → details
→ registration workflow and identify the actual failing stage before changing
authentication code. A new SMS-only login flow would require a separately
approved backend authentication design. No backend, database, schema, or profile
design change has been made for this issue.
