import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const VisitorInvitation = () => {
  const { token } = useParams();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://fic-visitor-1.onrender.com');
        let baseUrl = API_URL;
        if (!baseUrl.endsWith('/api')) {
          baseUrl = `${baseUrl}/api`;
        }
        const response = await fetch(`${baseUrl}/visitor-invitations/${token}`);
        const data = await response.json();
        
        if (response.ok) {
          setInvitation(data.invitation);
        } else {
          setError(data.message || "Failed to load invitation");
        }
        setLoading(false);
      } catch (err) {
        console.error("Error fetching invitation:", err);
        setError("Failed to load invitation");
        setLoading(false);
      }
    };

    if (token) {
      fetchInvitation();
    }
  }, [token]);

  if (loading) {
    return (
      <div style={styles.container}>
        <p>Loading invitation details...</p>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={{ color: "red", textAlign: "center" }}>Error</h2>
          <p style={{ textAlign: "center" }}>{error || "Invitation not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={{ margin: 0, color: "#1E1B6E" }}>FIC VMS</h2>
          <h3 style={{ marginTop: "5px", color: "#555" }}>Visitor Invitation</h3>
        </div>

        <div style={styles.body}>
          <Detail label="Visitor Name" value={invitation.visitorName} />
          <Detail label="Email" value={invitation.email} />
          <Detail label="Mobile" value={invitation.mobile} />
          <Detail label="Company" value={invitation.companyName} />
          <Detail label="Purpose of Visit" value={invitation.purposeOfVisit} />
          <Detail label="Visit Date" value={invitation.visitDate} />
          <Detail label="Visit Time" value={invitation.visitTime} />
          <Detail label="Branch" value={invitation.branch} />
          <Detail label="Number of Visitors" value={invitation.numberOfVisitors} />
          <Detail label="Notes" value={invitation.notes} />
          <div style={{ ...styles.detail, borderBottom: "none", marginTop: "10px" }}>
            <span style={styles.label}>Status</span>
            <span style={{ 
              fontWeight: "bold", 
              color: invitation.status === 'PENDING' ? '#f59e0b' : 
                     invitation.status === 'APPROVED' ? '#10b981' : '#ef4444' 
            }}>
              {invitation.status}
            </span>
          </div>
        </div>

        <div style={styles.footer}>
          <p>Please present this invitation when you arrive at the office.</p>
        </div>
      </div>
    </div>
  );
};

const Detail = ({ label, value }) => {
  return (
    <div style={styles.detail}>
      <span style={styles.label}>{label}</span>
      <span style={styles.value}>{value || "Not provided"}</span>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#f4f7f6",
    fontFamily: "sans-serif",
    padding: "20px"
  },
  card: {
    backgroundColor: "#fff",
    padding: "30px",
    borderRadius: "10px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    maxWidth: "450px",
    width: "100%"
  },
  header: {
    textAlign: "center",
    borderBottom: "2px solid #f0f0f0",
    paddingBottom: "15px",
    marginBottom: "20px"
  },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  detail: {
    display: "flex",
    justifyContent: "space-between",
    borderBottom: "1px solid #f0f0f0",
    paddingBottom: "8px"
  },
  label: {
    fontWeight: "600",
    color: "#666",
    fontSize: "0.95rem"
  },
  value: {
    color: "#111",
    textAlign: "right",
    fontWeight: "500",
    fontSize: "0.95rem"
  },
  footer: {
    textAlign: "center",
    marginTop: "25px",
    color: "#888",
    fontSize: "0.85rem",
    borderTop: "1px dashed #ddd",
    paddingTop: "15px"
  }
};

export default VisitorInvitation;
