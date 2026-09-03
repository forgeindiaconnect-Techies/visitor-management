import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { createWorker } from 'tesseract.js';
import { 
  Calendar, User, Clock, Building, CheckCircle2, Phone, Mail, 
  Car, ShieldAlert, ArrowLeft, Printer, QrCode, Sparkles, Upload, FileText, Download
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import FaceCamera from '../../components/FaceCamera';
import logoImg from '../../assets/logo.svg';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import TimeDropdown from '../../components/TimeDropdown';

const formatTimeTo12Hour = (timeStr) => {
  if (!timeStr) return '';
  if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) {
    return timeStr;
  }
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = hours < 10 ? '0' + hours : hours;
  return `${formattedHours}:${minutes} ${ampm}`;
};

const isAllowedDay = (date) => {
  const day = date.getDay();
  // Monday = 1, Wednesday = 3, Saturday = 6
  return [1, 3, 6].includes(day);
};

const getNextAllowedVisitDate = () => {
  const d = new Date();
  while (![1, 3, 6].includes(d.getDay())) {
    d.setDate(d.getDate() + 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const PublicPreBooking = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { companyCode: routeCodeParam, companyId: routeCompanyId } = useParams();
  const fileInputRef = useRef(null);
  const ocrWorkerRef = useRef(null);
  const [ocrProgress, setOcrProgress] = useState(0);

  // Company Validation State
  const [isValidatingCompany, setIsValidatingCompany] = useState(true);
  const [companyError, setCompanyError] = useState('');
  const [targetCompany, setTargetCompany] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [availableHosts, setAvailableHosts] = useState([]);
  const [availableBranches, setAvailableBranches] = useState([]);
  const [branches, setBranches] = useState([]);

  // Form State
  const [formData, setFormData] = useState({
    visitorName: '',
    mobileNumber: '',
    email: '',
    companyName: '',
    hostName: '',
    assignedHr: '',
    selectedHostLabel: '',
    purpose: 'Business Meeting',
    visitDate: getNextAllowedVisitDate(),
    expectedArrivalTime: '10:00',
    vehicleNumber: '',
    branch: '',
    idType: '',
    idProofUrl: '',
    idVerificationStatus: '',
    idVerificationToken: '',
  });

  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [idProofPreview, setIdProofPreview] = useState('');
  const [uploadingIdProof, setUploadingIdProof] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [mobileError, setMobileError] = useState('');
  const [alreadyRegisteredModal, setAlreadyRegisteredModal] = useState(false);
  const [preBookResult, setPreBookResult] = useState(null);
  const [step, setStep] = useState(1); // 1: Form, 2: Success QR Pass
  const [
    idValidationPopup,
    setIdValidationPopup
  ] = useState({
    open: false,
    type: '',
    title: '',
    message: ''
  });

  // Returning visitor states
  const [checkingVisitor, setCheckingVisitor] = useState(false);
  const [returningVisitor, setReturningVisitor] = useState(false);
  const [activeBooking, setActiveBooking] = useState(null);

  const _rawUrl = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
  const API_BASE = _rawUrl.replace(/\/api\/?$/, '');

  // Validate company when the public pre-booking link opens
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);

    const companyCode = String(
      routeCodeParam || routeCompanyId || searchParams.get('companyId') || ''
    ).trim().toUpperCase();

    const validateCompany = async () => {
      // Do not allow a generic link without a registered company ID
      if (!companyCode) {
        setTargetCompany(null);
        setCompanyError(
          "This pre-booking link is invalid. Please use the official link provided by the company."
        );
        setIsValidatingCompany(false);
        return;
      }

      try {
        setIsValidatingCompany(true);
        setCompanyError('');

        const res = await fetch(
          `${API_BASE}/api/prebookings/validate/${encodeURIComponent(companyCode)}`
        );

        const data = await res.json();

        if (!res.ok || !data.success) {
          setTargetCompany(null);
          setCompanyError(
            data.message ||
            "This pre-booking link is invalid or unavailable. Please contact the company administrator."
          );
          return;
        }

        const normalizedCompany = {
          ...data.company,

          companyId:
            data.company.companyId ||
            data.company.code ||
            companyCode,

          code:
            data.company.code ||
            data.company.companyId ||
            companyCode,

          companyName:
            data.company.companyName ||
            data.company.name ||
            'Registered Company',

          name:
            data.company.name ||
            data.company.companyName ||
            'Registered Company'
        };

        setTargetCompany(normalizedCompany);

        const dynamicHosts =
          normalizedCompany.hosts || [];

        const dynamicBranches =
          normalizedCompany.branches || [];
        setAvailableHosts(dynamicHosts);
        setAvailableBranches(dynamicBranches);

        setFormData((previousData) => ({
          ...previousData,
          companyId:
            normalizedCompany.companyId,
          companyName:
            normalizedCompany.companyName,
          branch: dynamicBranches?.[0] || ''
        }));
      } catch (error) {
        setTargetCompany(null);
        setCompanyError(
          "Unable to validate the pre-booking link. Please try again later."
        );
      } finally {
        setIsValidatingCompany(false);
      }
    };

    validateCompany();
  }, [routeCompanyId, location.search, API_BASE]);

  useEffect(() => {
    const loadBranches = async () => {
      const companyCode = targetCompany?.code || targetCompany?.companyId || routeCodeParam || routeCompanyId;
      if (!companyCode) return;

      try {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const API_BASE = baseUrl.replace(/\/api\/?$/, '');

        const response = await fetch(
          `${API_BASE}/api/branch-settings/public/${companyCode}`
        );

        const result = await response.json();

        if (response.ok) {
          setBranches(result.data || []);
        } else {
          setBranches([]);
        }
      } catch (error) {
        console.error('Unable to load company branches:', error);
        setBranches([]);
      }
    };

    loadBranches();
  }, [targetCompany?.code, targetCompany?.companyId, routeCodeParam, routeCompanyId]);

  const checkReturningVisitor = async (mobile) => {
    const cleanMobile = String(mobile || '').replace(/\D/g, '');

    if (cleanMobile.length !== 10) {
      setReturningVisitor(false);
      setActiveBooking(null);
      return;
    }

    try {
      setCheckingVisitor(true);

      const API_URL =
        import.meta.env.VITE_API_URL ||
        (window.location.hostname === 'localhost'
          ? 'http://localhost:5000'
          : 'https://zone-monitor.onrender.com');

      const res = await fetch(
        `${API_URL}/api/prebookings/returning-visitor/${cleanMobile}`
      );

      const data = await res.json();

      if (!res.ok) {
        return;
      }

      if (data.hasActiveBooking) {
        setActiveBooking(data.data);
        setReturningVisitor(true);
        return;
      }

      if (data.returningVisitor && data.data) {
        setReturningVisitor(true);
        setActiveBooking(null);

        // KEEP OLD PERSONAL DETAILS & CLEAR APPOINTMENT DETAILS
        setFormData(prev => ({
          ...prev,
          visitorName: data.data.fullName || prev.visitorName || '',
          mobileNumber: data.data.mobileNumber || cleanMobile,
          email: data.data.email || '',
          vehicleNumber: data.data.vehicleNumber || '',
          // CLEAR OLD APPOINTMENT DETAILS
          hostName: '',
          assignedHr: '',
          selectedHostLabel: '',
          purpose: '',
          visitDate: '',
          expectedArrivalTime: '',
          branch: ''
        }));
      } else {
        setReturningVisitor(false);
        setActiveBooking(null);
      }

    } catch (error) {
      console.error('Returning visitor check failed:', error);
    } finally {
      setCheckingVisitor(false);
    }
  };

  const resetReturningVisitor = () => {
    setReturningVisitor(false);
    setActiveBooking(null);
    setCapturedPhoto(null);
    setIdProofPreview('');
    setFormData(prev => ({
      ...prev,
      visitorName: '',
      mobileNumber: '',
      email: '',
      companyName: targetCompany?.companyName || prev.companyName,
      companyId: targetCompany?.companyId || prev.companyId,
      hostName: '',
      assignedHr: '',
      selectedHostLabel: '',
      purpose: 'Business Meeting',
      visitDate: getNextAllowedVisitDate(),
      expectedArrivalTime: '10:00',
      vehicleNumber: '',
      branch: availableBranches[0] || prev.branch,
      idType: '',
      idProofUrl: ''
    }));
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mobileParam = params.get('mobile');
    if (mobileParam) {
      const clean = mobileParam.replace(/\D/g, '').slice(0, 10);
      if (clean.length === 10) {
        setFormData(prev => ({ ...prev, mobileNumber: clean }));
        checkReturningVisitor(clean);
      }
    }
  }, [location.search]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'mobileNumber') {
      const cleanVal = value.replace(/\D/g, '').slice(0, 10);
      setFormData(prev => ({ ...prev, [name]: cleanVal }));

      if (cleanVal.length === 0) {
        setMobileError("");
        setReturningVisitor(false);
        setActiveBooking(null);
      } else if (!/^[6-9]\d{9}$/.test(cleanVal)) {
        setMobileError("Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.");
        setReturningVisitor(false);
        setActiveBooking(null);
      } else {
        setMobileError("");
        if (cleanVal.length === 10) {
          checkReturningVisitor(cleanVal);
        } else {
          setReturningVisitor(false);
          setActiveBooking(null);
        }
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const validateSelectedDocument = (selectedType, extractedText) => {
    const text = String(extractedText || '')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();

    const compactText = text.replace(/[^A-Z0-9]/g, '');
    const digitsOnly = text.replace(/\D/g, '');

    const aadhaarNumber =
      /\d{12}/.test(digitsOnly) ||
      /X{4}\s*X{4}\s*\d{4}/.test(text) ||
      /\d{4}\s+\d{4}\s+\d{4}/.test(text);

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
    ].some((word) => text.includes(word));

    const panNumber = /[A-Z]{5}[0-9]{4}[A-Z]/.test(compactText);

    const panWords = [
      'INCOME TAX',
      'PERMANENT ACCOUNT NUMBER',
      'PERMANENT ACCOUNT'
    ].some((word) => text.includes(word));

    const drivingLicenceWords = [
      'DRIVING LICENCE',
      'DRIVING LICENSE',
      'DL NO',
      'DL NUMBER',
      'LICENCE NO',
      'LICENSE NO'
    ].some((word) => text.includes(word));

    const passportWords = [
      'PASSPORT',
      'REPUBLIC OF INDIA',
      'NATIONALITY',
      'PLACE OF BIRTH'
    ].some((word) => text.includes(word));

    const strongAadhaar = aadhaarNumber && aadhaarWords;
    const strongPan = panNumber && panWords;
    const passport = text.includes('PASSPORT') && passportWords;

    if (text.length < 15) {
      return { valid: true, requiresManualReview: true };
    }

    if (selectedType === 'Aadhaar Card') {
      if (strongAadhaar) return { valid: true };
      if (strongPan || drivingLicenceWords || passport) {
        return { valid: false, message: `The selected document does not match Aadhaar Card.` };
      }
      return { valid: true, requiresManualReview: true };
    }

    if (selectedType === 'PAN Card') {
      if (strongPan) return { valid: true };
      if (strongAadhaar || drivingLicenceWords || passport) {
        return { valid: false, message: `The selected document does not match PAN Card.` };
      }
      return { valid: true, requiresManualReview: true };
    }

    if (selectedType === 'Driving Licence') {
      if (drivingLicenceWords) return { valid: true };
      if (strongAadhaar || strongPan || passport) {
        return { valid: false, message: `The selected document does not match Driving Licence.` };
      }
      return { valid: true, requiresManualReview: true };
    }

    if (selectedType === 'Passport') {
      if (passport) return { valid: true };
      if (strongAadhaar || strongPan || drivingLicenceWords) {
        return { valid: false, message: `The selected document does not match Passport.` };
      }
      return { valid: true, requiresManualReview: true };
    }

    return { valid: true, requiresManualReview: true };
  };

  const showIdValidationPopup = (
    type,
    title,
    message
  ) => {
    setIdValidationPopup({
      open: true,
      type,
      title,
      message
    });
  };

  const handleIdProofChange = async (event) => {
    const inputElement = event.target;
    const file = inputElement.files?.[0];

    if (!file) return;

    const clearSelectedFile = () => {
      inputElement.value = '';
      setIdProofPreview('');

      setFormData((previous) => ({
        ...previous,
        idProofUrl: '',
        idVerificationStatus: '',
        idVerificationToken: ''
      }));
    };

    if (!formData.idType) {
      clearSelectedFile();

      setErrorMsg(
        'Please select an ID proof type before uploading.'
      );

      return;
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.type)) {
      clearSelectedFile();

      setErrorMsg(
        'Upload only a PNG, JPG, JPEG, or WebP image.'
      );

      return;
    }

    const maximumSize = 5 * 1024 * 1024;

    if (file.size > maximumSize) {
      clearSelectedFile();

      setErrorMsg(
        'The ID proof image must be smaller than 5 MB.'
      );

      return;
    }

    setUploadingIdProof(true);
    setOcrProgress(0);
    setErrorMsg('');
    setIdProofPreview('');

    try {
      // Create and reuse one OCR worker.
      if (!ocrWorkerRef.current) {
        ocrWorkerRef.current =
          await createWorker(
            'eng',
            undefined,
            {
              logger: (progress) => {
                if (
                  progress.status ===
                  'recognizing text'
                ) {
                  setOcrProgress(
                    Math.round(
                      progress.progress * 100
                    )
                  );
                }
              }
            }
          );
      }

      // Read the document locally.
      const ocrResult =
        await ocrWorkerRef.current.recognize(
          file
        );

      const extractedText =
        ocrResult?.data?.text || '';

      const documentValidation =
        validateSelectedDocument(
          formData.idType,
          extractedText
        );

      if (!documentValidation.valid) {
        throw new Error(
          documentValidation.message
        );
      }

      // OCR text must not be saved or logged.
      const previewData =
        await new Promise(
          (resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () =>
              resolve(reader.result);

            reader.onerror = () =>
              reject(
                new Error(
                  'Unable to preview the ID image.'
                )
              );

            reader.readAsDataURL(file);
          }
        );

      setIdProofPreview(previewData);

      // Upload only after validation succeeds.
      const uploadData = new FormData();

      uploadData.append('photo', file);
      uploadData.append(
        'idType',
        formData.idType
      );
      uploadData.append(
        'companyId',
        targetCompany?.companyId || targetCompany?.code || routeCodeParam || routeCompanyId || ''
      );

      const uploadResponse = await fetch(
        `${API_BASE}/api/visitors/upload-id-proof`,
        {
          method: 'POST',
          body: uploadData
        }
      );

      const uploadResult =
        await uploadResponse.json();

      if (
        !uploadResponse.ok ||
        !uploadResult.url
      ) {
        throw new Error(
          uploadResult.message ||
          'Failed to upload the ID proof.'
        );
      }

      if (!uploadResult.verificationToken) {
        throw new Error(
          'The server did not return ID verification proof. Please upload the document again.'
        );
      }

      setFormData((previous) => ({
        ...previous,

        idProofUrl:
          uploadResult.url,

        idVerificationStatus:
          uploadResult.verificationStatus,

        idVerificationToken:
          uploadResult.verificationToken
      }));

      if (
        uploadResult.verificationStatus ===
        'VERIFIED'
      ) {
        showIdValidationPopup(
          'success',
          'Document Verified',
          `Your ${formData.idType} has been verified successfully.`
        );
      } else if (
        uploadResult.verificationStatus ===
        'MANUAL_REVIEW'
      ) {
        showIdValidationPopup(
          'success',
          'Document Uploaded',
          `Your ${formData.idType} has been uploaded successfully and is awaiting manual verification.`
        );
      }

      setErrorMsg('');
    } catch (error) {
      console.error(
        'ID proof validation failed:',
        error
      );

      clearSelectedFile();

      showIdValidationPopup(
        'error',
        'Incorrect Document',
        formData.idType === 'Aadhaar Card'
          ? 'This image is not recognized as an Aadhaar Card. Please upload your correct Aadhaar Card.'
          : `This image does not match ${formData.idType}. Please upload the correct document.`
      );

      setErrorMsg('');
    } finally {
      setUploadingIdProof(false);
      setOcrProgress(0);
    }
  };

  useEffect(() => {
    return () => {
      if (ocrWorkerRef.current) {
        ocrWorkerRef.current.terminate();
        ocrWorkerRef.current = null;
      }
    };
  }, []);

  const handlePrintPass = () => {
    window.print();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.visitorName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(formData.mobileNumber.trim())) {
      setMobileError('Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
      setErrorMsg('Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
      return;
    } else {
      setMobileError('');
    }
    if (!formData.hostName || !formData.selectedHostLabel) {
      setErrorMsg('Please select a host employee to meet.');
      return;
    }
    if (!formData.purpose) {
      setErrorMsg('Please select the purpose of your visit.');
      return;
    }
    if (!formData.visitDate) {
      setErrorMsg('Please select a visit date.');
      return;
    }
    const chosenDate = new Date(`${formData.visitDate}T00:00:00`);
    if (!isAllowedDay(chosenDate)) {
      setErrorMsg('Visits can only be booked on Monday, Wednesday, or Saturday.');
      return;
    }
    if (!formData.expectedArrivalTime) {
      setErrorMsg('Please select an expected arrival time.');
      return;
    }
    if (!formData.branch) {
      setErrorMsg(
        "No branch is available. Please ask the company administrator to add a branch."
      );
      return;
    }
    if (!capturedPhoto) {
      setErrorMsg('Face photo capture is mandatory to pre-book a visit pass.');
      return;
    }
    if (!formData.idType) {
      setErrorMsg(
        'Please select an ID proof type.'
      );
      return;
    }

    if (
      !formData.idProofUrl ||
      !idProofPreview
    ) {
      setErrorMsg(
        `Please upload your selected ${formData.idType}.`
      );
      return;
    }

    if (
      ![
        'VERIFIED',
        'MANUAL_REVIEW'
      ].includes(
        formData.idVerificationStatus
      )
    ) {
      setErrorMsg(
        'Your ID proof has not been validated. Please upload it again.'
      );
      return;
    }

    if (!formData.idVerificationToken) {
      setErrorMsg(
        'ID proof verification is missing. Please upload the document again.'
      );
      return;
    }

    if (uploadingIdProof) {
      setErrorMsg('Please wait for the ID proof photo to finish uploading.');
      return;
    }

    setLoading(true);

    try {
      // 1. Upload captured photo to Cloudinary
      let finalPhotoUrl = capturedPhoto;
      if (capturedPhoto.startsWith('data:image')) {
        try {
          const formDataUpload = new FormData();
          const responsePhoto = await fetch(capturedPhoto);
          const blob = await responsePhoto.blob();
          formDataUpload.append("photo", blob, "visitor-photo.jpg");

          const uploadResponse = await fetch(`${API_BASE}/api/visitors/upload`, {
            method: "POST",
            body: formDataUpload
          });

          const uploadResult = await uploadResponse.json();
          if (uploadResponse.ok && uploadResult.url) {
            finalPhotoUrl = uploadResult.url;
          } else {
            console.warn("Cloudinary upload failed: ", uploadResult.message);
          }
        } catch (uploadErr) {
          console.error("Error uploading photo to Cloudinary:", uploadErr);
        }
      }

      const verifiedCompanyId =
        targetCompany?.companyId ||
        targetCompany?.code;

      const verifiedCompanyName =
        targetCompany?.companyName ||
        targetCompany?.name;

      if (!verifiedCompanyId) {
        setErrorMsg(
          "Company validation failed. Please reopen the official company pre-booking link."
        );
        return;
      }

      // 2. Submit payload to backend
      const payload = {
        companyId: verifiedCompanyId,
        fullName: formData.visitorName,
        mobileNumber: formData.mobileNumber,
        email: formData.email,
        visitingCompany:
          verifiedCompanyName ||
          formData.companyName ||
          '',
        hostEmployee: formData.hostName,
        visitPurpose: formData.purpose,
        visitDate: formData.visitDate,
        expectedTime: formatTimeTo12Hour(formData.expectedArrivalTime),
        branchLocation: formData.branch,
        vehicleNumber: formData.vehicleNumber,
        facePhoto: finalPhotoUrl,
        idType: formData.idType,
        idProofUrl: formData.idProofUrl,
        idVerificationStatus:
          formData.idVerificationStatus,
        idVerificationToken:
          formData.idVerificationToken,
        assignedHr: formData.assignedHr,
        returningVisitor: Boolean(returningVisitor),
        isReturningVisitor: Boolean(returningVisitor),
        isReturning: Boolean(returningVisitor),
        // Compatibility fields:
        visitorName: formData.visitorName,
        companyName:
          verifiedCompanyName ||
          formData.companyName ||
          '',
        hostName: formData.hostName,
        purpose: formData.purpose,
        branch: formData.branch,
        photoUrl: finalPhotoUrl
      };

      const response = await fetch(`${API_BASE}/api/prebookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.status === 409 || data.code === "ALREADY_REGISTERED") {
        const errorText = "Already Registered — You already have an active pre-booking. Please wait until your existing visit is completed before registering again.";
        setErrorMsg(errorText);
        setAlreadyRegisteredModal(true);
        return;
      }

      const savedRecord =
        data.data ||
        data.visitor ||
        data.preBooking ||
        data.booking ||
        null;

      if (
        response.ok &&
        data.success &&
        savedRecord
      ) {
        const newVisitorId = savedRecord.visitorId || savedRecord.visitId || "Generated Successfully";

        setPreBookResult({
          visitId: newVisitorId,
          visitorName: savedRecord.fullName || savedRecord.visitorName,
          mobileNumber: savedRecord.mobileNumber,
          email: savedRecord.email,
          companyName:
            savedRecord.visitingCompany ||
            savedRecord.companyName ||
            verifiedCompanyName ||
            'Registered Company',
          companyId:
            savedRecord.companyId ||
            verifiedCompanyId,
          hostName: savedRecord.hostEmployee || savedRecord.hostName,
          purpose: savedRecord.visitPurpose || savedRecord.purpose,
          visitDate: savedRecord.visitDate ? new Date(savedRecord.visitDate).toISOString().split('T')[0] : formData.visitDate,
          expectedArrivalTime: savedRecord.expectedTime || formData.expectedArrivalTime,
          branch: savedRecord.branchLocation || savedRecord.branch,
          photoUrl: savedRecord.facePhoto || savedRecord.photoUrl,
          idType: savedRecord.idType || formData.idType,
          idProofUrl: savedRecord.idProofUrl || formData.idProofUrl,
          status: savedRecord.status || 'PENDING'
        });

        // RESET FORM FOR NEXT REGISTRATION
        setReturningVisitor(false);
        setActiveBooking(null);
        setCapturedPhoto(null);
        setIdProofPreview('');
        setFormData({
          visitorName: '',
          mobileNumber: '',
          email: '',
          companyName: targetCompany?.companyName || '',
          companyId: targetCompany?.companyId || '',
          hostName: '',
          assignedHr: '',
          selectedHostLabel: '',
          purpose: 'Business Meeting',
          visitDate: getNextAllowedVisitDate(),
          expectedArrivalTime: '10:00',
          vehicleNumber: '',
          branch: availableBranches[0] || '',
          idType: '',
          idProofUrl: '',
          idVerificationStatus: '',
          idVerificationToken: ''
        });

        setStep(2);
      } else {
        throw new Error(data.message || 'Pre-booking registration failed.');
      }
    } catch (err) {
      console.error("Pre-booking Submit Error:", err);
      setErrorMsg(err.message || 'Failed to submit pre-booking request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQR = () => {
    try {
      const svgElement = document.querySelector('#prebooking-qr-code svg') || document.querySelector('.prebooking-qr-box svg') || document.querySelector('svg');
      if (!svgElement) {
        alert("QR Code element not found for download.");
        return;
      }

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const padding = 40;
        const qrSize = 300;
        canvas.width = qrSize + (padding * 2);
        canvas.height = qrSize + (padding * 2) + 90;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 4;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

        ctx.drawImage(image, padding, padding, qrSize, qrSize);

        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        const visitIdText = preBookResult?.visitId ? `ID: ${preBookResult.visitId}` : 'VISITOR PASS QR';
        ctx.fillText(visitIdText, canvas.width / 2, padding + qrSize + 35);

        ctx.fillStyle = '#475569';
        ctx.font = '12px sans-serif';
        ctx.fillText('SCAN AT GATE / RECEPTION KIOSK', canvas.width / 2, padding + qrSize + 58);

        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `PreBooking_QR_${preBookResult?.visitId || 'Pass'}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(blobURL);
      };
      image.src = blobURL;
    } catch (err) {
      console.error("QR Download Error:", err);
      alert("Failed to download QR Code image.");
    }
  };

  const inputClassName = "block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-brand-yellow)]/60 focus:border-[var(--color-brand-indigo)] outline-none bg-gray-50/50 hover:bg-gray-50/80 transition-all duration-300 text-gray-800 placeholder-gray-400 font-medium";
  const selectClassName = "block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-brand-yellow)]/60 focus:border-[var(--color-brand-indigo)] outline-none bg-gray-50/50 hover:bg-gray-50/80 transition-all duration-300 text-gray-700 font-semibold";

  if (isValidatingCompany) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-[#1E1B6E] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-gray-600">Verifying company pre-booking link...</p>
        </div>
      </div>
    );
  }

  if (companyError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-indigo-100 p-8 text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 text-[#1E1B6E]">
            <Building size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Company Pre-Booking</h2>
          <p className="text-xs text-gray-500 mb-6">{companyError}</p>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const clean = manualCode.trim().toUpperCase();
              if (clean) navigate(`/pre-booking/${clean}`);
            }} 
            className="mb-6 space-y-3"
          >
            <label className="text-xs font-bold text-gray-700 block text-left uppercase tracking-wider">
              Enter Your Company ID to Open Pass Form:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="e.g. PO0347 or FIC001"
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#1E1B6E] hover:bg-indigo-900 text-white text-xs font-bold rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
              >
                Proceed
              </button>
            </div>
            <p className="text-[11px] text-gray-400 text-left">
              Contact your host or company administrator if you don't know your Company ID.
            </p>
          </form>

          <button 
            onClick={() => navigate('/')}
            className="text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
          >
            ← Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-moving-gradient relative overflow-x-hidden flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8">
      {/* White background overlay */}
      <div className="absolute inset-0 bg-white/85 pointer-events-none -z-10" />

      {/* Decorative floating yellow & blue blobs */}
      <div className="fixed -top-20 -left-20 w-96 h-96 bg-amber-200/50 rounded-full blur-[100px] pointer-events-none animate-float-bg -z-10" />
      <div className="fixed -bottom-20 -right-20 w-96 h-96 bg-sky-200/50 rounded-full blur-[100px] pointer-events-none animate-float-bg-reverse -z-10" />
      <div className="fixed top-1/3 right-1/4 w-72 h-72 bg-indigo-100/30 rounded-full blur-[90px] pointer-events-none animate-float-bg -z-10" />

      {/* Header Bar */}
      <div className="max-w-3xl w-full mx-auto flex flex-col items-center justify-center mb-6 z-10 gap-2">
        {targetCompany?.branding?.logoUrl ? (
          <img
            src={targetCompany.branding.logoUrl}
            alt={`${targetCompany?.companyName || targetCompany?.name || 'Company'} logo`}
            className="h-20 max-w-[220px] object-contain rounded-xl"
          />
        ) : (
          <img src={logoImg} alt="Company Logo" className="h-16 w-16 object-contain" />
        )}
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight text-center">
          Visitor Registration – {targetCompany?.companyName || targetCompany?.name || 'Company'}
        </h1>
      </div>

      {/* Main Container Card */}
      <div className="max-w-3xl w-full mx-auto bg-white border border-gray-100 border-t-4 border-t-[#FFC20E] rounded-3xl shadow-2xl p-6 sm:p-8 flex-grow flex flex-col justify-center z-10">
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500 flex-shrink-0" />
            {errorMsg}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center space-y-2 mb-6">
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center justify-center gap-2">
                <Sparkles className="text-[var(--color-brand-indigo)] w-6 h-6 animate-pulse" /> Visitor Registration
              </h2>
              <p className="text-sm text-gray-500 max-w-sm mx-auto font-medium">
                Complete photo capture and meeting details to generate your official pass.
              </p>
            </div>

            {/* Camera Component Section */}
            <div className="bg-slate-50/50 border border-gray-100 rounded-2xl p-4 shadow-inner">
              <FaceCamera onCapture={(photo) => setCapturedPhoto(photo)} />
            </div>

            {/* Returning Visitor / Active Booking Full Width Banner */}
            {returningVisitor && !activeBooking && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-0.5">
                  <p className="font-bold text-green-900 text-sm flex items-center gap-1.5">
                    <span>✨</span> Welcome back, <span className="underline decoration-green-500 font-extrabold">{formData.visitorName || 'Visitor'}</span>!
                  </p>
                  <p className="text-xs text-green-700 font-medium">
                    Your existing visitor profile has been loaded. Personal details are locked. Please select your new appointment details below.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetReturningVisitor}
                  className="px-3.5 py-1.5 bg-white border border-green-300 text-green-800 hover:bg-green-100/60 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shadow-xs"
                >
                  Search another visitor
                </button>
              </div>
            )}

            {activeBooking && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="font-bold text-orange-900 text-sm flex items-center gap-1.5">
                  <span>⚠️</span> You already have an active appointment.
                </p>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-orange-800 bg-white/70 p-2.5 rounded-xl border border-orange-100">
                  <div><span className="font-semibold text-gray-500">ID:</span> <span className="font-bold">{activeBooking.visitorId}</span></div>
                  <div><span className="font-semibold text-gray-500">Date:</span> <span className="font-bold">{new Date(activeBooking.visitDate).toLocaleDateString()}</span></div>
                  <div><span className="font-semibold text-gray-500">Time:</span> <span className="font-bold">{activeBooking.expectedTime}</span></div>
                  <div><span className="font-semibold text-gray-500">Status:</span> <span className="font-bold">{activeBooking.status}</span></div>
                </div>
              </div>
            )}

            {/* Form Fields Grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-3.5 text-[var(--color-brand-indigo)]" />
                  <input
                    type="text"
                    name="visitorName"
                    value={formData.visitorName}
                    onChange={handleChange}
                    readOnly={returningVisitor && !activeBooking}
                    placeholder="e.g. Rahul Verma"
                    className={`${inputClassName} ${
                      returningVisitor && !activeBooking
                        ? 'bg-gray-100 text-gray-700 cursor-not-allowed'
                        : 'bg-white'
                    }`}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Mobile Number *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-[var(--color-brand-indigo)]" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    name="mobileNumber"
                    value={formData.mobileNumber}
                    readOnly={returningVisitor && !activeBooking}
                    onChange={handleChange}
                    placeholder="Enter 10-digit mobile number"
                    className={`${inputClassName} ${
                      returningVisitor && !activeBooking
                        ? 'bg-gray-100 text-gray-700 cursor-not-allowed'
                        : 'bg-white'
                    } ${mobileError ? 'border-red-500 focus:ring-red-500' : ''}`}
                    required
                  />
                </div>
                {mobileError && (
                  <p className="text-red-500 text-xs mt-1 font-semibold flex items-center gap-1">
                    ⚠️ {mobileError}
                  </p>
                )}

                {checkingVisitor && (
                  <p className="text-sm text-gray-500 mt-1">
                    Checking visitor details...
                  </p>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-[var(--color-brand-indigo)]" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    readOnly={returningVisitor && !activeBooking}
                    placeholder="name@company.com"
                    className={`${inputClassName} ${
                      returningVisitor && !activeBooking
                        ? 'bg-gray-100 text-gray-700 cursor-not-allowed'
                        : 'bg-white'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Visiting Company</label>
                <div className="relative">
                  <Building className="w-4 h-4 absolute left-3.5 top-3.5 text-[var(--color-brand-indigo)]" />
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName || targetCompany?.companyName || "Company Pre-Booking"}
                    readOnly
                    className={`block w-full pl-10 pr-3 py-2.5 border rounded-xl text-sm font-semibold select-none ${
                      returningVisitor && !activeBooking
                        ? 'bg-gray-100 text-gray-700 cursor-not-allowed border-gray-200'
                        : 'border-indigo-100 bg-indigo-50/30 text-indigo-900 font-bold cursor-not-allowed'
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Host Employee to Meet *</label>
                <select
                  name="assignedHr"
                  value={formData.assignedHr || formData.selectedHostLabel || ""}
                  onChange={(e) => {
                    const selectedVal = e.target.value;
                    const option = availableHosts.find(o => String(o.id) === selectedVal || o.name === selectedVal);
                    setFormData(prev => ({
                      ...prev,
                      assignedHr: option?.id || null,
                      hostName: option ? option.name : selectedVal,
                      selectedHostLabel: option ? option.label : selectedVal
                    }));
                  }}
                  className={selectClassName}
                  required
                >
                  <option value="">Select Host Employee</option>
                  {availableHosts.map((opt, idx) => (
                    <option key={idx} value={opt.id || opt.name}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Purpose of Visit *</label>
                <select
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleChange}
                  className={selectClassName}
                >
                  <option value="Business Meeting">Business Meeting</option>
                  <option value="Interview">Interview</option>
                  <option value="Vendor / Client visit">Vendor / Client visit</option>
                  <option value="Delivery / Courier">Delivery / Courier</option>
                  <option value="Personal Visit">Personal Visit</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Date of Visit *</label>
                <DatePicker
                  selected={formData.visitDate ? new Date(`${formData.visitDate}T00:00:00`) : null}
                  onChange={(date) => {
                    if (!date) {
                      handleChange({ target: { name: 'visitDate', value: '' } });
                      return;
                    }
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, "0");
                    const day = String(date.getDate()).padStart(2, "0");
                    handleChange({ target: { name: 'visitDate', value: `${year}-${month}-${day}` } });
                  }}
                  filterDate={isAllowedDay}
                  minDate={new Date()}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="Select visit date"
                  className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-brand-yellow)]/60 focus:border-[var(--color-brand-indigo)] outline-none bg-gray-50/50 text-gray-800 transition-shadow font-semibold cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Expected Arrival Time</label>
                <TimeDropdown
                  name="expectedArrivalTime"
                  value={formData.expectedArrivalTime}
                  onChange={handleChange}
                  className="block w-full py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-brand-yellow)]/60 focus:border-[var(--color-brand-indigo)] outline-none bg-gray-50/50 text-gray-800 transition-shadow font-semibold cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Branch Location *</label>
                <select
                  name="branch"
                  value={formData.branch || formData.branchLocation || ''}
                  onChange={(e) => {
                    handleChange(e);
                    setFormData(prev => ({ ...prev, branch: e.target.value, branchLocation: e.target.value }));
                  }}
                  className={selectClassName}
                  required
                >
                  <option value="">Select Branch</option>

                  {branches.map((branch) => (
                    <option
                      key={branch._id || branch.branchName}
                      value={branch.branchName}
                    >
                      {branch.branchName}
                    </option>
                  ))}
                </select>
              </div>
          </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">ID Proof Type *</label>
                <select
                  name="idType"
                  value={formData.idType}
                  onChange={(event) => {
                    const newIdType = event.target.value;

                    setFormData((previous) => ({
                      ...previous,
                      idType: newIdType,

                      // Remove the previous document when type changes.
                      idProofUrl: '',
                      idVerificationStatus: '',
                      idVerificationToken: ''
                    }));

                    setIdProofPreview('');

                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className={selectClassName}
                  required
                >
                  <option value="">
                    -- Select ID Type --
                  </option>

                  <option value="Aadhaar Card">
                    Aadhaar Card
                  </option>

                  <option value="PAN Card">
                    PAN Card
                  </option>

                  <option value="Driving Licence">
                    Driving Licence
                  </option>

                  <option value="Passport">
                    Passport
                  </option>

                  <option value="Other">
                    Other Government ID
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Upload Selected ID Proof *</label>
                <div className="relative flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleIdProofChange}
                    accept="image/jpeg,image/png,image/webp"
                    required={!formData.idProofUrl}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!formData.idType) {
                        setErrorMsg(
                          'Please select an ID proof type before uploading the document.'
                        );
                        return;
                      }

                      setErrorMsg('');
                      fileInputRef.current?.click();
                    }}
                    className="flex-grow flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-bold py-3 px-4 rounded-xl transition-all shadow-sm h-11"
                  >
                    <Upload size={14} className="text-[var(--color-brand-indigo)]" />
                    {uploadingIdProof
                      ? ocrProgress > 0
                        ? `Checking ${formData.idType} — ${ocrProgress}%`
                        : `Preparing ${formData.idType} check...`
                      : formData.idType
                        ? `Upload ${formData.idType}`
                        : 'Select ID Type First'}
                  </button>
                  {idProofPreview && (
                    <div className="w-11 h-11 rounded-xl overflow-hidden border border-gray-200 relative group flex-shrink-0">
                      <img src={idProofPreview} alt="ID Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setIdProofPreview('');

                          setFormData((previous) => ({
                            ...previous,
                            idProofUrl: '',
                            idVerificationStatus: '',
                            idVerificationToken: ''
                          }));

                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="absolute inset-0 bg-black/50 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>


            <button
              type="submit"
              disabled={loading || !!activeBooking}
              className={`w-full py-3.5 rounded-xl text-white font-bold shadow-lg transition-all flex items-center justify-center gap-2 transform active:scale-[0.99] text-base ${
                activeBooking 
                  ? 'bg-gray-400 cursor-not-allowed shadow-none' 
                  : 'bg-[var(--color-brand-indigo)] hover:bg-[var(--color-brand-indigo-light)] shadow-indigo-900/20'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating Pass...
                </>
              ) : activeBooking ? (
                'Active Booking Already Exists'
              ) : (
                <>
                  Generate Pre-Booking Pass
                  <QrCode className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-6 text-center animate-fadeIn py-6">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 mb-1 shadow-sm">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>
            
            <div>
              <h4 className="text-2xl font-black text-gray-900 tracking-tight">Pre-Booking Submitted!</h4>
              {preBookResult.status === 'APPROVED' || preBookResult.status === 'Approved' ? (
                <p className="text-xs text-emerald-600 font-bold mt-1 bg-emerald-50 inline-block px-3 py-1 rounded-full border border-emerald-100">Status: APPROVED ✓</p>
              ) : (
                <p className="text-xs text-amber-600 font-bold mt-1 bg-amber-50 inline-block px-3 py-1 rounded-full border border-amber-100">Status: PENDING Approval</p>
              )}
              <p className="text-xs text-gray-500 mt-3 max-w-sm mx-auto font-medium leading-relaxed">
                Scan this QR code or present your Visitor ID at the gate reception kiosk to complete entry validation.
              </p>
            </div>

            <div className="mx-auto grid max-w-xl grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Visiting Company
                </p>

                <p className="mt-1 text-sm font-bold text-slate-900">
                  {preBookResult.companyName ||
                    targetCompany?.companyName ||
                    targetCompany?.name ||
                    'Registered Company'}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Company Code
                </p>

                <p className="mt-1 text-sm font-bold text-slate-900">
                  {preBookResult.companyId ||
                    targetCompany?.companyId ||
                    targetCompany?.code ||
                    '—'}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Visitor
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {preBookResult.visitorName || '—'}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Host
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {preBookResult.hostName || '—'}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Branch
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {preBookResult.branch || '—'}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Visit Date
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {preBookResult.visitDate || '—'}
                </p>
              </div>
            </div>

            {/* QR Card */}
            <div className="bg-slate-50 border border-gray-200/80 rounded-3xl p-6 shadow-xl flex flex-col items-center justify-center space-y-4 max-w-sm mx-auto">
              <div className="px-4 py-1.5 rounded-full bg-indigo-50 text-[var(--color-brand-indigo)] text-xs font-mono font-bold border border-indigo-100 shadow-sm">
                ID: {preBookResult.visitId}
              </div>

              <div id="prebooking-qr-code" className="p-5 bg-white rounded-3xl shadow-md flex flex-col items-center justify-center border border-gray-100 prebooking-qr-box">
                <QRCodeSVG 
                  value={`https://visitor-management-indol.vercel.app/pass/${preBookResult.visitId}`}
                  size={180} 
                />
                <span className="text-[10px] font-mono text-slate-700 mt-3 font-bold uppercase tracking-wider">
                  SCAN AT GATE / RECEPTION KIOSK
                </span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3 pt-4">
              <button
                type="button"
                onClick={handleDownloadQR}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download QR Code
              </button>
              <button
                type="button"
                onClick={handlePrintPass}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-gray-300 transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4 text-[var(--color-brand-indigo)]" />
                Print Pass
              </button>
              <button
                onClick={() => {
                  setCapturedPhoto(null);
                  setIdProofPreview('');
                  setFormData({
                    visitorName: '',
                    mobileNumber: '',
                    email: '',

                    companyId:
                      targetCompany?.companyId ||
                      targetCompany?.code ||
                      '',

                    companyName:
                      targetCompany?.companyName ||
                      targetCompany?.name ||
                      '',

                    hostName: '',
                    assignedHr: '',
                    selectedHostLabel: '',

                    purpose: 'Business Meeting',
                    visitDate: getNextAllowedVisitDate(),
                    expectedArrivalTime: '10:00',

                    vehicleNumber: '',

                    branch:
                      availableBranches?.[0] ||
                      branches?.[0]?.branchName ||
                      '',

                    idType: '',
                    idProofUrl: '',
                    idVerificationStatus: '',
                    idVerificationToken: ''
                  });
                  setStep(1);
                }}
                className="px-5 py-2.5 rounded-xl bg-[var(--color-brand-indigo)] hover:bg-[var(--color-brand-indigo-light)] text-white font-semibold text-xs transition-colors shadow-md"
              >
                Book Another Visit
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer copyright */}
      <div className="text-center text-xs text-slate-400 mt-8 font-medium">
        &copy; {new Date().getFullYear()} Forge India Connect Pvt Ltd. All rights reserved.
      </div>

      {/* Already Registered Custom Modal */}
      {alreadyRegisteredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl border border-amber-200 shadow-2xl p-6 sm:p-8 max-w-md w-full text-center space-y-5 animate-scaleUp">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-amber-200">
              <ShieldAlert size={36} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Already Registered</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed font-medium">
                You already have an active pre-booking. Please wait until your existing visit is completed before registering again.
              </p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-800 text-xs font-semibold">
              🔒 Multiple active pre-bookings per visitor are restricted.
            </div>
            <button
              type="button"
              onClick={() => setAlreadyRegisteredModal(false)}
              className="w-full py-3 bg-[var(--color-brand-indigo)] hover:bg-[var(--color-brand-indigo-light)] text-white font-bold rounded-xl transition-all shadow-md text-sm cursor-pointer"
            >
              OK / Close
            </button>
          </div>
        </div>
      )}

      {/* ID Proof Validation Popup Modal */}
      {idValidationPopup.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div
              className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
                idValidationPopup.type === 'success'
                  ? 'bg-green-100'
                  : 'bg-red-100'
              }`}
            >
              {idValidationPopup.type === 'success' ? (
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              ) : (
                <ShieldAlert className="h-8 w-8 text-red-600" />
              )}
            </div>

            <h3 className="mt-4 text-xl font-black text-slate-900">
              {idValidationPopup.title}
            </h3>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              {idValidationPopup.message}
            </p>

            {idValidationPopup.type === 'error' && (
              <button
                type="button"
                onClick={() => {
                  setIdValidationPopup({
                    open: false,
                    type: '',
                    title: '',
                    message: ''
                  });

                  fileInputRef.current?.click();
                }}
                className="mt-6 w-full rounded-xl bg-indigo-700 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-800"
              >
                Upload Correct{' '}
                {formData.idType || 'Document'}
              </button>
            )}

            {idValidationPopup.type === 'success' && (
              <button
                type="button"
                onClick={() =>
                  setIdValidationPopup({
                    open: false,
                    type: '',
                    title: '',
                    message: ''
                  })
                }
                className="mt-6 w-full rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white hover:bg-green-700"
              >
                Continue
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                setIdValidationPopup({
                  open: false,
                  type: '',
                  title: '',
                  message: ''
                })
              }
              className="mt-3 w-full rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicPreBooking;
