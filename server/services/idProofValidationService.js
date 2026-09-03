const { createWorker } = require('tesseract.js');

let workerPromise = null;
let ocrQueue = Promise.resolve();

const allowedIdTypes = [
  'Aadhaar Card',
  'PAN Card',
  'Driving Licence',
  'Passport',
  'Other'
];

const getWorker = async () => {
  if (!workerPromise) {
    workerPromise = createWorker('eng');
  }

  return workerPromise;
};

const getDocumentMatches = (text) => {
  const normalizedText = String(text || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  const compactText = normalizedText.replace(/[^A-Z0-9]/g, '');
  const digitsOnly = normalizedText.replace(/\D/g, '');

  const aadhaarNumber =
    /\d{12}/.test(digitsOnly) ||
    /X{4}\s*X{4}\s*\d{4}/.test(normalizedText) ||
    /\d{4}\s+\d{4}\s+\d{4}/.test(normalizedText);

  const aadhaarWords = [
    'AADHAAR',
    'AADHAR',
    'UIDAI',
    'UNIQUE IDENTIFICATION',
    'GOVERNMENT OF INDIA',
    'GOVT OF INDIA',
    'MERI PEHCHAAN',
    'YEAR OF BIRTH',
    'DOB'
  ].some((word) => normalizedText.includes(word));

  const panNumber = /[A-Z]{5}[0-9]{4}[A-Z]/.test(compactText);

  const panWords = [
    'INCOME TAX',
    'PERMANENT ACCOUNT NUMBER',
    'PERMANENT ACCOUNT'
  ].some((word) => normalizedText.includes(word));

  const drivingLicenceWords = [
    'DRIVING LICENCE',
    'DRIVING LICENSE',
    'DL NO',
    'DL NUMBER',
    'LICENCE NO',
    'LICENSE NO'
  ].some((word) => normalizedText.includes(word));

  const passportWords = [
    'PASSPORT',
    'REPUBLIC OF INDIA',
    'NATIONALITY',
    'PLACE OF BIRTH'
  ].some((word) => normalizedText.includes(word));

  return {
    aadhaar: aadhaarNumber || aadhaarWords,
    strongAadhaar: aadhaarNumber && aadhaarWords,

    pan: panNumber || panWords,
    strongPan: panNumber && panWords,

    drivingLicence: drivingLicenceWords,

    passport:
      normalizedText.includes('PASSPORT') &&
      passportWords
  };
};

const manualReviewResult = (idType) => ({
  valid: true,
  requiresManualReview: true,
  message:
    `${idType} uploaded successfully and is awaiting manual verification.`
});

const invalidResult = (idType) => ({
  valid: false,
  requiresManualReview: false,
  message:
    `The selected document does not match ${idType}. Please upload the correct document.`
});

const validateExtractedText = (
  idType,
  extractedText,
  confidence = 0
) => {
  const text = String(extractedText || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  const matches = getDocumentMatches(text);

  // OCR could not read enough text. Do not falsely reject
  // the document as an incorrect Aadhaar/PAN/etc.
  if (text.length < 15 || Number(confidence) < 25) {
    return manualReviewResult(idType);
  }

  if (idType === 'Aadhaar Card') {
    if (matches.strongAadhaar) {
      return {
        valid: true,
        requiresManualReview: false,
        message: 'Aadhaar Card verified successfully.'
      };
    }

    // Reject only when OCR clearly identifies another ID.
    if (
      matches.strongPan ||
      matches.drivingLicence ||
      matches.passport
    ) {
      return invalidResult(idType);
    }

    return manualReviewResult(idType);
  }

  if (idType === 'PAN Card') {
    if (matches.strongPan) {
      return {
        valid: true,
        requiresManualReview: false,
        message: 'PAN Card verified successfully.'
      };
    }

    if (
      matches.strongAadhaar ||
      matches.drivingLicence ||
      matches.passport
    ) {
      return invalidResult(idType);
    }

    return manualReviewResult(idType);
  }

  if (idType === 'Driving Licence') {
    if (matches.drivingLicence) {
      return {
        valid: true,
        requiresManualReview: false,
        message: 'Driving Licence verified successfully.'
      };
    }

    if (
      matches.strongAadhaar ||
      matches.strongPan ||
      matches.passport
    ) {
      return invalidResult(idType);
    }

    return manualReviewResult(idType);
  }

  if (idType === 'Passport') {
    if (matches.passport) {
      return {
        valid: true,
        requiresManualReview: false,
        message: 'Passport verified successfully.'
      };
    }

    if (
      matches.strongAadhaar ||
      matches.strongPan ||
      matches.drivingLicence
    ) {
      return invalidResult(idType);
    }

    return manualReviewResult(idType);
  }

  if (idType === 'Other') {
    return manualReviewResult(idType);
  }

  return {
    valid: false,
    requiresManualReview: false,
    message: 'Please select a valid ID proof type.'
  };
};

const validateIdProof = async ({
  idType,
  imageBuffer
}) => {
  if (!allowedIdTypes.includes(idType)) {
    return {
      valid: false,
      requiresManualReview: false,
      message: 'Please select a valid ID proof type.'
    };
  }

  if (!imageBuffer?.length) {
    return {
      valid: false,
      requiresManualReview: false,
      message: 'Please upload the selected ID proof.'
    };
  }

  const processOcr = async () => {
    const worker = await getWorker();
    const result = await worker.recognize(imageBuffer);

    return validateExtractedText(
      idType,
      result?.data?.text || '',
      result?.data?.confidence || 0
    );
  };

  const queuedResult = ocrQueue.then(
    processOcr,
    processOcr
  );

  ocrQueue = queuedResult.catch(() => {});

  try {
    return await queuedResult;
  } catch (error) {
    console.error(
      'ID proof OCR processing failed:',
      error.message
    );

    // OCR technical failure must not incorrectly claim
    // that a genuine document is the wrong type.
    return manualReviewResult(idType);
  }
};

module.exports = {
  allowedIdTypes,
  validateIdProof
};
