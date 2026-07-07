package com.sharemechat.support.dto;

/**
 * Payload rico del contador para el badge admin. Un solo endpoint que devuelve
 * los 3 conteos en una llamada, evitando polling multiplicado. Ver ADR-046.
 */
public class PendingCountDTO {

    private long pendingUnassigned;
    private long myAssigned;
    private long otherAssigned;

    public long getPendingUnassigned() { return pendingUnassigned; }
    public void setPendingUnassigned(long pendingUnassigned) { this.pendingUnassigned = pendingUnassigned; }
    public long getMyAssigned() { return myAssigned; }
    public void setMyAssigned(long myAssigned) { this.myAssigned = myAssigned; }
    public long getOtherAssigned() { return otherAssigned; }
    public void setOtherAssigned(long otherAssigned) { this.otherAssigned = otherAssigned; }
}
