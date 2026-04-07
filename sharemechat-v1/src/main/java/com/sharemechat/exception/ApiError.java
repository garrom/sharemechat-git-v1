package com.sharemechat.exception;

import java.time.LocalDateTime;

public class ApiError {
  private LocalDateTime timestamp = LocalDateTime.now();
  private int status;
  private String error;
  private String message;
  private String path; // opcional: lo rellenamos si tenemos HttpServletRequest
  private String code;
  private String scope;
  private String nextAction;

  public ApiError() {}

  public ApiError(int status, String error, String message, String path) {
    this.status = status;
    this.error = error;
    this.message = message;
    this.path = path;
  }

  public LocalDateTime getTimestamp() { return timestamp; }
  public int getStatus() { return status; }
  public void setStatus(int status) { this.status = status; }
  public String getError() { return error; }
  public void setError(String error) { this.error = error; }
  public String getMessage() { return message; }
  public void setMessage(String message) { this.message = message; }
  public String getPath() { return path; }
  public void setPath(String path) { this.path = path; }
  public String getCode() { return code; }
  public void setCode(String code) { this.code = code; }
  public String getScope() { return scope; }
  public void setScope(String scope) { this.scope = scope; }
  public String getNextAction() { return nextAction; }
  public void setNextAction(String nextAction) { this.nextAction = nextAction; }
}
