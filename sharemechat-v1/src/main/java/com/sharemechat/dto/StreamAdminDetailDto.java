package com.sharemechat.dto;

import java.util.List;

public class StreamAdminDetailDto {

    private StreamActiveAdminRowDto stream;
    private List<StreamStatusEventDto> events;

    public StreamAdminDetailDto() {
    }

    public StreamActiveAdminRowDto getStream() {
        return stream;
    }

    public void setStream(StreamActiveAdminRowDto stream) {
        this.stream = stream;
    }

    public List<StreamStatusEventDto> getEvents() {
        return events;
    }

    public void setEvents(List<StreamStatusEventDto> events) {
        this.events = events;
    }
}
