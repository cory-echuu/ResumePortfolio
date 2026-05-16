import { useState, useEffect, useCallback } from "react";
import { postTailor, postCompose } from "../lib/api.js";
import { applyTailorPlan } from "../lib/applyTailorPlan.js";
import {
  listVersions,
  saveVersion,
  loadVersion,
  deleteVersion,
} from "../lib/cvVersions.js";
import { buildGmailComposeUrl } from "../lib/gmail.js";
import { useI18n } from "../i18n/I18nProvider.jsx";

const PERSONAS = [
  { id: "hr", label: "HR" },
  { id: "curator", label: "CURATOR" },
  { id: "immigration", label: "EB-1 / O-1" },
];

const labelStyle = {
  fontSize: 6.5,
  fontWeight: 600,
  letterSpacing: "0.18em",
  color: "#bbb",
  marginBottom: 6,
  display: "block",
};

const inputStyle = {
  width: "100%",
  border: "1px solid #ccc",
  background: "#fff",
  padding: "6px 8px",
  fontSize: 8,
  fontFamily: "inherit",
  borderRadius: 0,
  resize: "vertical",
  minHeight: 56,
  boxSizing: "border-box",
};

export default function CareerKitPanel({
  data,
  setData,
  setPreset,
  btn,
  btnA,
  viewCount,
  viewsStorage,
}) {
  const { t, locale } = useI18n();
  const [jobDescription, setJobDescription] = useState("");
  const [persona, setPersona] = useState("hr");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [company, setCompany] = useState("");
  const [versionName, setVersionName] = useState("");
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState("");
  const [agentNote, setAgentNote] = useState("");
  const [cover, setCover] = useState(null);

  const refreshVersions = useCallback(() => {
    setVersions(listVersions());
  }, []);

  useEffect(() => {
    refreshVersions();
  }, [refreshVersions]);

  const handleTailor = async () => {
    setError("");
    setAgentNote("");
    if (!jobDescription.trim()) {
      setError(t("needJd"));
      return;
    }
    setLoading("tailor");
    try {
      const res = await postTailor({
        cvData: data,
        jobDescription,
        persona,
      });
      setData(res.data);
      setPreset(res.preset ?? null);
      const hook = res.hookLine || res.plan?.hookLine;
      setAgentNote(
        [
          hook ? `${t("hookLine")}: ${hook}` : "",
          res.plan?.summary || "",
        ]
          .filter(Boolean)
          .join("\n\n") + (res.placeholder ? `\n\n(${t("needLlm")})` : "")
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  };

  const handleSaveVersion = () => {
    saveVersion({
      name: versionName || `JD · ${persona} · ${new Date().toLocaleDateString()}`,
      data,
      meta: { persona, jobDescription: jobDescription.slice(0, 500) },
    });
    setVersionName("");
    refreshVersions();
  };

  const handleRestore = (id) => {
    const v = loadVersion(id);
    if (v) {
      setData(v.data);
      if (v.meta?.jobDescription) setJobDescription(v.meta.jobDescription);
      if (v.meta?.persona) setPersona(v.meta.persona);
      setAgentNote(`已恢复版本：${v.name}`);
    }
  };

  const handleCompose = async () => {
    setError("");
    if (!jobDescription.trim()) {
      setError(t("needJd"));
      return;
    }
    setLoading("compose");
    try {
      const res = await postCompose({
        cvData: data,
        jobDescription,
        recipientName,
        company,
      });
      setCover(res);
      openGmail(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  };

  const openGmail = (coverObj = cover) => {
    if (!coverObj?.body) return;
    const url = buildGmailComposeUrl({
      to: recipientEmail.trim(),
      subject: coverObj.subject,
      body: coverObj.body,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #d6d8dc" }}>
      <div style={{ fontSize: 7, fontWeight: 600, letterSpacing: "0.28em", color: "#aaa", marginBottom: 10 }}>
        {t("careerKit")}
      </div>

      {viewCount != null && (
        <div
          style={{
            fontSize: 7,
            color: "#666",
            marginBottom: 10,
            padding: "6px 8px",
            background: "#e8eaed",
            letterSpacing: "0.06em",
          }}
        >
          {t("views")} · {viewCount.toLocaleString()}
          {viewsStorage === "memory" && (
            <span style={{ color: "#999", marginLeft: 6 }}>({t("dev")})</span>
          )}
        </div>
      )}

      <span style={labelStyle}>{t("jobDescription")}</span>
      <textarea
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        placeholder={t("jdPlaceholder")}
        style={{ ...inputStyle, minHeight: 72, marginBottom: 10 }}
      />

      <span style={labelStyle}>{t("agentLens")}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 10 }}>
        {PERSONAS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="sidebar-btn"
            onClick={() => setPersona(p.id)}
            style={persona === p.id ? btnA : btn}
          >
            {p.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleTailor}
        disabled={loading === "tailor"}
        style={{ ...btnA, width: "100%", padding: "7px", fontSize: 7.5, marginBottom: 8 }}
      >
        {loading === "tailor" ? t("tailoring") : t("tailor")}
      </button>

      {agentNote && (
        <p
          style={{
            fontSize: 7,
            lineHeight: 1.5,
            color: "#555",
            marginBottom: 10,
            whiteSpace: "pre-wrap",
          }}
        >
          {agentNote}
        </p>
      )}

      <span style={{ ...labelStyle, marginTop: 4 }}>{t("versions")}</span>
      <input
        type="text"
        value={versionName}
        onChange={(e) => setVersionName(e.target.value)}
        placeholder={t("versionName")}
        style={{ ...inputStyle, minHeight: 28, marginBottom: 6 }}
      />
      <button
        type="button"
        onClick={handleSaveVersion}
        style={{ ...btn, width: "100%", padding: "6px", fontSize: 7.5, marginBottom: 8 }}
      >
        {t("saveVersion")}
      </button>
      <div style={{ maxHeight: 100, overflowY: "auto", marginBottom: 10 }}>
        {versions.length === 0 && (
          <span style={{ fontSize: 7, color: "#aaa" }}>{t("noVersions")}</span>
        )}
        {versions.map((v) => (
          <div
            key={v.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginBottom: 4,
              fontSize: 7,
            }}
          >
            <button
              type="button"
              onClick={() => handleRestore(v.id)}
              style={{ ...btn, flex: 1, padding: "4px 6px", fontSize: 7, textAlign: "left" }}
            >
              {v.name}
            </button>
            <button
              type="button"
              onClick={() => {
                deleteVersion(v.id);
                refreshVersions();
              }}
              style={{ ...btn, padding: "4px 6px", fontSize: 7 }}
              title="删除"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <span style={labelStyle}>{t("outreach")}</span>
      <input
        type="email"
        value={recipientEmail}
        onChange={(e) => setRecipientEmail(e.target.value)}
        placeholder={t("hrEmail")}
        style={{ ...inputStyle, minHeight: 28, marginBottom: 6 }}
      />
      <input
        type="text"
        value={recipientName}
        onChange={(e) => setRecipientName(e.target.value)}
        placeholder={t("recipientName")}
        style={{ ...inputStyle, minHeight: 28, marginBottom: 6 }}
      />
      <input
        type="text"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        placeholder={t("company")}
        style={{ ...inputStyle, minHeight: 28, marginBottom: 8 }}
      />

      <button
        type="button"
        onClick={handleCompose}
        disabled={loading === "compose"}
        style={{ ...btn, width: "100%", padding: "7px", fontSize: 7.5, marginBottom: 6 }}
      >
        {loading === "compose" ? t("writing") : t("draftLetter")}
      </button>

      {cover?.body && (
        <>
          <textarea
            readOnly
            value={cover.body}
            style={{ ...inputStyle, minHeight: 88, marginBottom: 6, fontSize: 7 }}
          />
          <button
            type="button"
            onClick={() => openGmail()}
            style={{ ...btnA, width: "100%", padding: "7px", fontSize: 7.5 }}
          >
            {t("gmailSend")}
          </button>
          {cover.placeholder && (
            <p style={{ fontSize: 6.5, color: "#999", marginTop: 6 }}>
              {t("needLlm")}
            </p>
          )}
        </>
      )}

      {error && (
        <p style={{ fontSize: 7, color: "#c42", marginTop: 8 }}>{error}</p>
      )}
    </div>
  );
}
