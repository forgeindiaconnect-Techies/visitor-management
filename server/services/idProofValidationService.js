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

const validateExtractedText = (
  idType,
  extractedText,
  ocrConfidence = 0
) => {
  const text = String(extractedText || '')
    .toUpperCase()
    .replace(/[|]/g, 'I')
    .replace(/\s+/g, ' ')
    .trim();

  const compactText = text.replace(
    /[^A-Z0-9]/g,
    ''
  );

  if (
    text.length < 30 ||
    Number(ocrConfidence) < 45
  ) {
    return {
      valid: false,
      requiresManualReview: false,
      detectedType: 'UNKNOWN',
      message:
        'The document is unclear or does not contain enough readable information. Upload a clear photo of the complete ID.'
    };
  }

  const containsPanIndicators =
    text.includes('INCOME TAX') ||
    text.includes(
      'PERMANENT ACCOUNT NUMBER'
    );

  const containsAadhaarIndicators =
    text.includes('AADHAAR') ||
    text.includes('AADHAR') ||
    text.includes('UIDAI') ||
    text.includes(
      'UNIQUE IDENTIFICATION AUTHORITY'
    );

  const containsDrivingIndicators =
    text.includes('DRIVING LICENCE') ||
    text.includes('DRIVING LICENSE') ||
    text.includes('DL NO') ||
    text.includes('LICENCE NO') ||
    text.includes('LICENSE NO');

  const containsPassportIndicators =
    text.includes('PASSPORT') ||
    text.includes('PASSPORT NO') ||
    text.includes('REPUBLIC OF INDIA');

  // PAN Card
  if (idType === 'PAN Card') {
    const hasPanNumber =
      /[A-Z]{5}[0-9]{4}[A-Z]/.test(
        compactText
      );

    const hasSupportingDetails =
      text.includes('DATE OF BIRTH') ||
      text.includes('FATHER') ||
      text.includes('SIGNATURE');

    const wrongDocument =
      containsAadhaarIndicators ||
      containsDrivingIndicators ||
      containsPassportIndicators;

    const valid =
      containsPanIndicators &&
      hasPanNumber &&
      hasSupportingDetails &&
      !wrongDocument;

    return {
      valid,
      requiresManualReview: false,
      detectedType:
        valid ? 'PAN Card' : 'UNKNOWN',
      message:
        'The uploaded image does not match PAN Card requirements. Upload the complete PAN Card showing its heading, PAN number and identity details.'
    };
  }

  // Aadhaar Card
  if (idType === 'Aadhaar Card') {
    const hasFormattedAadhaarNumber =
      /\b[0-9]{4}\s+[0-9]{4}\s+[0-9]{4}\b/.test(
        text
      );

    const hasCompactAadhaarNumber =
      /\b[0-9]{12}\b/.test(text);

    const hasMaskedAadhaarNumber =
      /\bX{4}\s*X{4}\s*[0-9]{4}\b/.test(
        text
      );

    const hasGovernmentHeading =
      text.includes(
        'GOVERNMENT OF INDIA'
      ) ||
      text.includes(
        'GOVT OF INDIA'
      ) ||
      text.includes(
        'भारत सरकार'
      );

    const hasIdentityDetails =
      text.includes('DATE OF BIRTH') ||
      text.includes('DOB') ||
      text.includes('YEAR OF BIRTH') ||
      text.includes('YOB') ||
      text.includes('MALE') ||
      text.includes('FEMALE') ||
      text.includes('ADDRESS');

    const wrongDocument =
      containsPanIndicators ||
      containsDrivingIndicators ||
      (
        text.includes('PASSPORT') &&
        !text.includes('AADHAAR')
      );

    const valid =
      containsAadhaarIndicators &&
      hasGovernmentHeading &&
      (
        hasFormattedAadhaarNumber ||
        hasCompactAadhaarNumber ||
        hasMaskedAadhaarNumber
      ) &&
      hasIdentityDetails &&
      !wrongDocument;

    return {
      valid,
      requiresManualReview: false,
      detectedType:
        valid ? 'Aadhaar Card' : 'UNKNOWN',
      message:
        'The uploaded image does not match Aadhaar Card requirements. Upload the complete Aadhaar Card showing the Aadhaar heading, number and identity details.'
    };
  }

  // Driving Licence
  if (idType === 'Driving Licence') {
    const hasHeading =
      text.includes('DRIVING LICENCE') ||
      text.includes('DRIVING LICENSE');

    const hasNumberLabel =
      text.includes('DL NO') ||
      text.includes('DL NUMBER') ||
      text.includes('LICENCE NO') ||
      text.includes('LICENSE NO');

    const hasSupportingDetails =
      text.includes('VALID') ||
      text.includes('DATE OF BIRTH') ||
      text.includes('DOB') ||
      text.includes('TRANSPORT') ||
      text.includes(
        'NON-TRANSPORT'
      ) ||
      text.includes(
        'BLOOD GROUP'
      );

    const wrongDocument =
      containsPanIndicators ||
      containsAadhaarIndicators ||
      containsPassportIndicators;

    const valid =
      hasHeading &&
      hasNumberLabel &&
      hasSupportingDetails &&
      !wrongDocument;

    return {
      valid,
      requiresManualReview: false,
      detectedType:
        valid
          ? 'Driving Licence'
          : 'UNKNOWN',
      message:
        'The uploaded image does not match Driving Licence requirements. Upload the complete licence showing its heading, licence number and validity details.'
    };
  }

  // Passport
  if (idType === 'Passport') {
    const hasHeading =
      text.includes('PASSPORT');

    const hasRepublicHeading =
      text.includes(
        'REPUBLIC OF INDIA'
      );

    const hasPassportFields =
      text.includes('PASSPORT NO') ||
      text.includes('SURNAME') ||
      text.includes('NATIONALITY');

    const hasIdentityDetails =
      text.includes('DATE OF BIRTH') ||
      text.includes('PLACE OF BIRTH') ||
      text.includes('DATE OF EXPIRY');

    const wrongDocument =
      containsPanIndicators ||
      containsAadhaarIndicators ||
      containsDrivingIndicators;

    const valid =
      hasHeading &&
      hasRepublicHeading &&
      hasPassportFields &&
      hasIdentityDetails &&
      !wrongDocument;

    return {
      valid,
      requiresManualReview: false,
      detectedType:
        valid ? 'Passport' : 'UNKNOWN',
      message:
        'The uploaded image does not match Passport requirements. Upload the complete Passport information page.'
    };
  }

  if (idType === 'Other') {
    return {
      valid: false,
      requiresManualReview: true,
      detectedType: 'OTHER',
      message:
        'Other government IDs cannot be automatically verified. Please select Aadhaar Card, PAN Card, Driving Licence, or Passport.'
    };
  }

  return {
    valid: false,
    requiresManualReview: false,
    detectedType: 'UNKNOWN',
    message:
      'Please select a valid ID proof type.'
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
      message:
        'Please select a valid ID proof type.'
    };
  }

  if (!imageBuffer?.length) {
    return {
      valid: false,
      requiresManualReview: false,
      message: 'ID proof image is required.'
    };
  }

  // Process OCR requests one at a time because one shared
  // Tesseract worker should not run overlapping jobs.
  const processOcr = async () => {
    const worker = await getWorker();

    const result = await worker.recognize(
      imageBuffer
    );

    const extractedText =
      result?.data?.text || '';

    const ocrConfidence =
      result?.data?.confidence || 0;

    // Never return or log extracted government-ID text.
    return validateExtractedText(
      idType,
      extractedText,
      ocrConfidence
    );
  };

  const queuedResult =
    ocrQueue.then(processOcr, processOcr);

  ocrQueue = queuedResult.catch(() => {});

  try {
    return await queuedResult;
  } catch (error) {
    console.error(
      'ID proof OCR processing failed:',
      error.message
    );

    return {
      valid: false,
      requiresManualReview: false,
      message:
        'Unable to verify the ID proof. Please upload a clearer image.'
    };
  }
};

module.exports = {
  allowedIdTypes,
  validateIdProof
};
