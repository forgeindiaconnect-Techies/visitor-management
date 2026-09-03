const crypto = require('crypto');

const getSigningSecret = () => {
  const secret =
    process.env.ID_PROOF_TOKEN_SECRET ||
    process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      'ID proof token secret is not configured.'
    );
  }

  return secret;
};

const encodePayload = (value) => {
  return Buffer.from(
    JSON.stringify(value)
  ).toString('base64url');
};

const createIdProofToken = ({
  companyId,
  idType,
  idProofUrl,
  verificationStatus
}) => {
  const payload = {
    companyId: String(companyId)
      .trim()
      .toUpperCase(),

    idType,
    idProofUrl,
    verificationStatus,

    issuedAt: Date.now(),

    expiresAt:
      Date.now() +
      30 * 60 * 1000
  };

  const encodedPayload =
    encodePayload(payload);

  const signature = crypto
    .createHmac(
      'sha256',
      getSigningSecret()
    )
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
};

const verifyIdProofToken = (token) => {
  if (
    !token ||
    typeof token !== 'string'
  ) {
    return {
      valid: false,
      message:
        'ID proof verification token is missing.'
    };
  }

  const parts = token.split('.');

  if (parts.length !== 2) {
    return {
      valid: false,
      message:
        'Invalid ID proof verification token.'
    };
  }

  const [
    encodedPayload,
    suppliedSignature
  ] = parts;

  const expectedSignature = crypto
    .createHmac(
      'sha256',
      getSigningSecret()
    )
    .update(encodedPayload)
    .digest('base64url');

  const suppliedBuffer = Buffer.from(
    suppliedSignature
  );

  const expectedBuffer = Buffer.from(
    expectedSignature
  );

  if (
    suppliedBuffer.length !==
      expectedBuffer.length ||
    !crypto.timingSafeEqual(
      suppliedBuffer,
      expectedBuffer
    )
  ) {
    return {
      valid: false,
      message:
        'ID proof verification could not be confirmed.'
    };
  }

  try {
    const payload = JSON.parse(
      Buffer.from(
        encodedPayload,
        'base64url'
      ).toString('utf8')
    );

    if (
      !payload.expiresAt ||
      payload.expiresAt <= Date.now()
    ) {
      return {
        valid: false,
        message:
          'ID proof verification has expired. Please upload the document again.'
      };
    }

    if (
      ![
        'VERIFIED',
        'MANUAL_REVIEW'
      ].includes(
        payload.verificationStatus
      )
    ) {
      return {
        valid: false,
        message:
          'Invalid ID proof verification status.'
      };
    }

    return {
      valid: true,
      payload
    };
  } catch {
    return {
      valid: false,
      message:
        'Invalid ID proof verification data.'
    };
  }
};

module.exports = {
  createIdProofToken,
  verifyIdProofToken
};
