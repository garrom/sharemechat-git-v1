package com.sharemechat.dto;

/**
 * Input del endpoint publico {@code POST /api/public/complaints} (sin
 * autenticacion). Campos reporter opcionales (denuncia anonima
 * permitida si el denunciante prefiere no facilitar email). Campos
 * subject opcionales (denunciante externo no conoce id interno).
 *
 * <p>Validacion en {@code ComplaintService.createPublic}: category
 * obligatoria del set {@link com.sharemechat.constants.Constants.ComplaintCategories},
 * description obligatoria y no vacia (max 2000 chars), reporter_email
 * con formato razonable si presente. No tracking code en Opcion B.
 */
public class PublicComplaintCreateDTO {

    private String reporterEmail;
    private String reporterName;
    private String category;
    private String description;
    private String subjectEmail;
    private String subjectUrl;
    private Long subjectStreamRecordId;

    public String getReporterEmail() { return reporterEmail; }
    public void setReporterEmail(String reporterEmail) { this.reporterEmail = reporterEmail; }

    public String getReporterName() { return reporterName; }
    public void setReporterName(String reporterName) { this.reporterName = reporterName; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getSubjectEmail() { return subjectEmail; }
    public void setSubjectEmail(String subjectEmail) { this.subjectEmail = subjectEmail; }

    public String getSubjectUrl() { return subjectUrl; }
    public void setSubjectUrl(String subjectUrl) { this.subjectUrl = subjectUrl; }

    public Long getSubjectStreamRecordId() { return subjectStreamRecordId; }
    public void setSubjectStreamRecordId(Long subjectStreamRecordId) { this.subjectStreamRecordId = subjectStreamRecordId; }
}
