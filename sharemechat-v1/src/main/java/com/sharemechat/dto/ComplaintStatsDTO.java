package com.sharemechat.dto;

/**
 * Resumen para AdminOverviewPanel y header de AdminComplaintsPanel.
 */
public class ComplaintStatsDTO {

    private long total;
    private long open;
    private long acknowledged;
    private long reviewing;
    private long resolved;
    private long rejected;
    private long escalated;
    private long slaBreached;
    private long slaNear;

    public long getTotal() { return total; }
    public void setTotal(long total) { this.total = total; }

    public long getOpen() { return open; }
    public void setOpen(long open) { this.open = open; }

    public long getAcknowledged() { return acknowledged; }
    public void setAcknowledged(long acknowledged) { this.acknowledged = acknowledged; }

    public long getReviewing() { return reviewing; }
    public void setReviewing(long reviewing) { this.reviewing = reviewing; }

    public long getResolved() { return resolved; }
    public void setResolved(long resolved) { this.resolved = resolved; }

    public long getRejected() { return rejected; }
    public void setRejected(long rejected) { this.rejected = rejected; }

    public long getEscalated() { return escalated; }
    public void setEscalated(long escalated) { this.escalated = escalated; }

    public long getSlaBreached() { return slaBreached; }
    public void setSlaBreached(long slaBreached) { this.slaBreached = slaBreached; }

    public long getSlaNear() { return slaNear; }
    public void setSlaNear(long slaNear) { this.slaNear = slaNear; }
}
