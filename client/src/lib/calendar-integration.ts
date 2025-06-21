/**
 * Calendar Integration System
 * Handles meeting scheduling, external calendar sync, and timezone management
 */

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  timeZone: string;
  location?: string;
  isAllDay: boolean;
  recurrence?: RecurrenceRule;
  attendees: CalendarAttendee[];
  organizer: CalendarAttendee;
  status: EventStatus;
  visibility: EventVisibility;
  reminders: EventReminder[];
  callDetails?: CallDetails;
  externalEventId?: string;
  externalCalendarId?: string;
  lastModified: Date;
  created: Date;
}

export interface CalendarAttendee {
  email: string;
  name: string;
  userId?: number;
  status: AttendeeStatus;
  isOptional: boolean;
  comment?: string;
}

export interface RecurrenceRule {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, etc.
  dayOfMonth?: number;
  weekOfMonth?: number;
  monthOfYear?: number;
  endDate?: Date;
  occurrences?: number;
  exceptions?: Date[];
}

export interface EventReminder {
  method: "email" | "popup" | "sms";
  minutesBefore: number;
  enabled: boolean;
}

export interface CallDetails {
  callId: string;
  type: "video" | "audio" | "screen_share";
  joinUrl: string;
  dialInNumbers?: string[];
  accessCode?: string;
  hostKey?: string;
}

export enum EventStatus {
  CONFIRMED = "confirmed",
  TENTATIVE = "tentative",
  CANCELLED = "cancelled",
}

export enum EventVisibility {
  PUBLIC = "public",
  PRIVATE = "private",
  CONFIDENTIAL = "confidential",
}

export enum AttendeeStatus {
  ACCEPTED = "accepted",
  DECLINED = "declined",
  TENTATIVE = "tentative",
  NEEDS_ACTION = "needsAction",
}

export interface ExternalCalendar {
  id: string;
  name: string;
  provider: CalendarProvider;
  email: string;
  isDefault: boolean;
  color: string;
  enabled: boolean;
  lastSyncTime: Date;
  syncToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export enum CalendarProvider {
  GOOGLE = "google",
  OUTLOOK = "outlook",
  APPLE = "apple",
  EXCHANGE = "exchange",
  CALDAV = "caldav",
}

export interface TimeZoneInfo {
  id: string;
  name: string;
  abbreviation: string;
  offset: number; // Minutes from UTC
  isDST: boolean;
}

export interface MeetingTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  duration: number; // Minutes
  defaultReminders: EventReminder[];
  defaultAttendees: string[];
  callSettings: {
    type: "video" | "audio";
    recordingEnabled: boolean;
    waitingRoomEnabled: boolean;
    muteOnJoin: boolean;
  };
}

export interface FreeBusyInfo {
  email: string;
  timeZone: string;
  busyTimes: Array<{
    start: Date;
    end: Date;
    status: "busy" | "tentative" | "free";
  }>;
}

class CalendarIntegrationService {
  private externalCalendars: Map<string, ExternalCalendar> = new Map();
  private timeZone: string;
  private meetingTemplates: Map<string, MeetingTemplate> = new Map();

  constructor() {
    this.timeZone = this.detectTimeZone();
    this.loadExternalCalendars();
    this.loadMeetingTemplates();
  }

  /**
   * Schedule a new meeting
   */
  async scheduleMeeting(meetingData: {
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendees: string[];
    timeZone?: string;
    recurrence?: RecurrenceRule;
    reminders?: EventReminder[];
    includeCall?: boolean;
    callType?: "video" | "audio";
    templateId?: string;
  }): Promise<CalendarEvent> {
    try {
      // Apply template if specified
      if (meetingData.templateId) {
        const template = this.meetingTemplates.get(meetingData.templateId);
        if (template) {
          meetingData = this.applyMeetingTemplate(meetingData, template);
        }
      }

      // Create call details if requested
      let callDetails: CallDetails | undefined;
      if (meetingData.includeCall) {
        callDetails = await this.createCallForMeeting(
          meetingData.callType || "video",
          meetingData.startTime,
          meetingData.endTime
        );
      }

      // Create calendar event
      const event: CalendarEvent = {
        id: this.generateEventId(),
        title: meetingData.title,
        description: meetingData.description,
        startTime: meetingData.startTime,
        endTime: meetingData.endTime,
        timeZone: meetingData.timeZone || this.timeZone,
        isAllDay: false,
        recurrence: meetingData.recurrence,
        attendees: meetingData.attendees.map((email) => ({
          email,
          name: email.split("@")[0],
          status: AttendeeStatus.NEEDS_ACTION,
          isOptional: false,
        })),
        organizer: {
          email: await this.getCurrentUserEmail(),
          name: await this.getCurrentUserName(),
          status: AttendeeStatus.ACCEPTED,
          isOptional: false,
        },
        status: EventStatus.CONFIRMED,
        visibility: EventVisibility.PUBLIC,
        reminders: meetingData.reminders || this.getDefaultReminders(),
        callDetails,
        lastModified: new Date(),
        created: new Date(),
      };

      // Save to local database
      await this.saveEvent(event);

      // Sync to external calendars
      await this.syncEventToExternalCalendars(event);

      // Send invitations
      await this.sendMeetingInvitations(event);

      // Schedule reminders
      await this.scheduleReminders(event);

      return event;
    } catch (error) {
      console.error("Failed to schedule meeting:", error);
      throw error;
    }
  }

  /**
   * Update an existing meeting
   */
  async updateMeeting(
    eventId: string,
    updates: Partial<CalendarEvent>
  ): Promise<CalendarEvent> {
    try {
      const existingEvent = await this.getEvent(eventId);
      if (!existingEvent) {
        throw new Error("Event not found");
      }

      const updatedEvent: CalendarEvent = {
        ...existingEvent,
        ...updates,
        lastModified: new Date(),
      };

      // Save updates
      await this.saveEvent(updatedEvent);

      // Sync to external calendars
      await this.syncEventToExternalCalendars(updatedEvent);

      // Send update notifications
      await this.sendMeetingUpdates(updatedEvent, existingEvent);

      return updatedEvent;
    } catch (error) {
      console.error("Failed to update meeting:", error);
      throw error;
    }
  }

  /**
   * Cancel a meeting
   */
  async cancelMeeting(eventId: string, reason?: string): Promise<void> {
    try {
      const event = await this.getEvent(eventId);
      if (!event) {
        throw new Error("Event not found");
      }

      // Update event status
      const cancelledEvent = {
        ...event,
        status: EventStatus.CANCELLED,
        description:
          event.description +
          (reason ? `\n\nCancellation reason: ${reason}` : ""),
        lastModified: new Date(),
      };

      await this.saveEvent(cancelledEvent);

      // Cancel in external calendars
      await this.syncEventToExternalCalendars(cancelledEvent);

      // Send cancellation notifications
      await this.sendMeetingCancellation(cancelledEvent, reason);

      // Cancel associated call
      if (event.callDetails) {
        await this.cancelCall(event.callDetails.callId);
      }
    } catch (error) {
      console.error("Failed to cancel meeting:", error);
      throw error;
    }
  }

  /**
   * Connect external calendar
   */
  async connectExternalCalendar(
    provider: CalendarProvider,
    credentials: any
  ): Promise<ExternalCalendar> {
    try {
      let calendar: ExternalCalendar;

      switch (provider) {
        case CalendarProvider.GOOGLE:
          calendar = await this.connectGoogleCalendar(credentials);
          break;
        case CalendarProvider.OUTLOOK:
          calendar = await this.connectOutlookCalendar(credentials);
          break;
        case CalendarProvider.APPLE:
          calendar = await this.connectAppleCalendar(credentials);
          break;
        default:
          throw new Error(`Unsupported calendar provider: ${provider}`);
      }

      this.externalCalendars.set(calendar.id, calendar);
      this.saveExternalCalendars();

      // Perform initial sync
      await this.syncExternalCalendar(calendar.id);

      return calendar;
    } catch (error) {
      console.error("Failed to connect external calendar:", error);
      throw error;
    }
  }

  /**
   * Sync with external calendars
   */
  async syncExternalCalendar(calendarId: string): Promise<void> {
    const calendar = this.externalCalendars.get(calendarId);
    if (!calendar || !calendar.enabled) {
      return;
    }

    try {
      switch (calendar.provider) {
        case CalendarProvider.GOOGLE:
          await this.syncGoogleCalendar(calendar);
          break;
        case CalendarProvider.OUTLOOK:
          await this.syncOutlookCalendar(calendar);
          break;
        case CalendarProvider.APPLE:
          await this.syncAppleCalendar(calendar);
          break;
      }

      // Update last sync time
      calendar.lastSyncTime = new Date();
      this.saveExternalCalendars();
    } catch (error) {
      console.error(`Failed to sync calendar ${calendarId}:`, error);
      throw error;
    }
  }

  /**
   * Get free/busy information for attendees
   */
  async getFreeBusyInfo(
    attendees: string[],
    startTime: Date,
    endTime: Date
  ): Promise<FreeBusyInfo[]> {
    try {
      const response = await fetch("/api/calendar/freebusy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({
          attendees,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get free/busy information");
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to get free/busy info:", error);
      throw error;
    }
  }

  /**
   * Find optimal meeting time
   */
  async findOptimalMeetingTime(
    attendees: string[],
    duration: number, // minutes
    preferredTimes: Array<{ start: Date; end: Date }>,
    constraints: {
      workingHours?: { start: string; end: string };
      workingDays?: number[];
      timeZone?: string;
    } = {}
  ): Promise<Array<{ start: Date; end: Date; score: number }>> {
    try {
      const response = await fetch("/api/calendar/optimal-time", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({
          attendees,
          duration,
          preferredTimes: preferredTimes.map((time) => ({
            start: time.start.toISOString(),
            end: time.end.toISOString(),
          })),
          constraints,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to find optimal meeting time");
      }

      const suggestions = await response.json();
      return suggestions.map((suggestion: any) => ({
        ...suggestion,
        start: new Date(suggestion.start),
        end: new Date(suggestion.end),
      }));
    } catch (error) {
      console.error("Failed to find optimal meeting time:", error);
      throw error;
    }
  }

  /**
   * Create meeting from template
   */
  async createMeetingFromTemplate(
    templateId: string,
    overrides: {
      startTime: Date;
      endTime?: Date;
      attendees?: string[];
      title?: string;
    }
  ): Promise<CalendarEvent> {
    const template = this.meetingTemplates.get(templateId);
    if (!template) {
      throw new Error("Meeting template not found");
    }

    const endTime =
      overrides.endTime ||
      new Date(overrides.startTime.getTime() + template.duration * 60000);

    return this.scheduleMeeting({
      title: overrides.title || template.title,
      description: template.description,
      startTime: overrides.startTime,
      endTime,
      attendees: overrides.attendees || template.defaultAttendees,
      reminders: template.defaultReminders,
      includeCall: true,
      callType: template.callSettings.type,
      templateId,
    });
  }

  /**
   * Get events for a date range
   */
  async getEvents(
    startDate: Date,
    endDate: Date,
    includeExternal: boolean = true
  ): Promise<CalendarEvent[]> {
    try {
      const response = await fetch("/api/calendar/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          includeExternal,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get events");
      }

      const events = await response.json();
      return events.map((event: any) => ({
        ...event,
        startTime: new Date(event.startTime),
        endTime: new Date(event.endTime),
        created: new Date(event.created),
        lastModified: new Date(event.lastModified),
      }));
    } catch (error) {
      console.error("Failed to get events:", error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async connectGoogleCalendar(
    credentials: any
  ): Promise<ExternalCalendar> {
    const response = await fetch("/api/calendar/connect/google", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      throw new Error("Failed to connect Google Calendar");
    }

    return await response.json();
  }

  private async connectOutlookCalendar(
    credentials: any
  ): Promise<ExternalCalendar> {
    const response = await fetch("/api/calendar/connect/outlook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      throw new Error("Failed to connect Outlook Calendar");
    }

    return await response.json();
  }

  private async connectAppleCalendar(
    credentials: any
  ): Promise<ExternalCalendar> {
    const response = await fetch("/api/calendar/connect/apple", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      throw new Error("Failed to connect Apple Calendar");
    }

    return await response.json();
  }

  private async syncGoogleCalendar(calendar: ExternalCalendar): Promise<void> {
    // Implementation for Google Calendar sync
    console.log("Syncing Google Calendar:", calendar.id);
  }

  private async syncOutlookCalendar(calendar: ExternalCalendar): Promise<void> {
    // Implementation for Outlook Calendar sync
    console.log("Syncing Outlook Calendar:", calendar.id);
  }

  private async syncAppleCalendar(calendar: ExternalCalendar): Promise<void> {
    // Implementation for Apple Calendar sync
    console.log("Syncing Apple Calendar:", calendar.id);
  }

  private async createCallForMeeting(
    type: "video" | "audio",
    startTime: Date,
    endTime: Date
  ): Promise<CallDetails> {
    const response = await fetch("/api/calls/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify({
        type,
        scheduledStart: startTime.toISOString(),
        scheduledEnd: endTime.toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create call");
    }

    return await response.json();
  }

  private async saveEvent(event: CalendarEvent): Promise<void> {
    await fetch("/api/calendar/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify(event),
    });
  }

  private async getEvent(eventId: string): Promise<CalendarEvent | null> {
    try {
      const response = await fetch(`/api/calendar/events/${eventId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const event = await response.json();
      return {
        ...event,
        startTime: new Date(event.startTime),
        endTime: new Date(event.endTime),
        created: new Date(event.created),
        lastModified: new Date(event.lastModified),
      };
    } catch {
      return null;
    }
  }

  private async syncEventToExternalCalendars(
    event: CalendarEvent
  ): Promise<void> {
    const promises = Array.from(this.externalCalendars.values())
      .filter((cal) => cal.enabled)
      .map((cal) => this.syncEventToCalendar(event, cal));

    await Promise.allSettled(promises);
  }

  private async syncEventToCalendar(
    event: CalendarEvent,
    calendar: ExternalCalendar
  ): Promise<void> {
    try {
      await fetch(`/api/calendar/sync/${calendar.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(event),
      });
    } catch (error) {
      console.error(`Failed to sync event to calendar ${calendar.id}:`, error);
    }
  }

  private async sendMeetingInvitations(event: CalendarEvent): Promise<void> {
    await fetch("/api/calendar/invitations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify({ eventId: event.id }),
    });
  }

  private async sendMeetingUpdates(
    updatedEvent: CalendarEvent,
    originalEvent: CalendarEvent
  ): Promise<void> {
    await fetch("/api/calendar/updates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify({
        eventId: updatedEvent.id,
        changes: this.getEventChanges(originalEvent, updatedEvent),
      }),
    });
  }

  private async sendMeetingCancellation(
    event: CalendarEvent,
    reason?: string
  ): Promise<void> {
    await fetch("/api/calendar/cancellations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify({ eventId: event.id, reason }),
    });
  }

  private async scheduleReminders(event: CalendarEvent): Promise<void> {
    await fetch("/api/calendar/reminders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify({ eventId: event.id }),
    });
  }

  private async cancelCall(callId: string): Promise<void> {
    await fetch(`/api/calls/${callId}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    });
  }

  private applyMeetingTemplate(
    meetingData: any,
    template: MeetingTemplate
  ): any {
    return {
      ...meetingData,
      title: meetingData.title || template.title,
      description: meetingData.description || template.description,
      reminders: meetingData.reminders || template.defaultReminders,
      attendees: [
        ...(meetingData.attendees || []),
        ...template.defaultAttendees,
      ],
    };
  }

  private getEventChanges(
    original: CalendarEvent,
    updated: CalendarEvent
  ): any {
    const changes: any = {};

    if (original.title !== updated.title) changes.title = updated.title;
    if (original.startTime.getTime() !== updated.startTime.getTime()) {
      changes.startTime = updated.startTime;
    }
    if (original.endTime.getTime() !== updated.endTime.getTime()) {
      changes.endTime = updated.endTime;
    }

    return changes;
  }

  private detectTimeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  private getDefaultReminders(): EventReminder[] {
    return [
      { method: "popup", minutesBefore: 15, enabled: true },
      { method: "email", minutesBefore: 60, enabled: true },
    ];
  }

  private generateEventId(): string {
    return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getCurrentUserEmail(): Promise<string> {
    // Get from auth context
    return "user@example.com";
  }

  private async getCurrentUserName(): Promise<string> {
    // Get from auth context
    return "Current User";
  }

  private loadExternalCalendars(): void {
    const stored = localStorage.getItem("externalCalendars");
    if (stored) {
      try {
        const calendars = JSON.parse(stored);
        this.externalCalendars = new Map(calendars);
      } catch {
        this.externalCalendars = new Map();
      }
    }
  }

  private saveExternalCalendars(): void {
    const calendars = Array.from(this.externalCalendars.entries());
    localStorage.setItem("externalCalendars", JSON.stringify(calendars));
  }

  private loadMeetingTemplates(): void {
    const stored = localStorage.getItem("meetingTemplates");
    if (stored) {
      try {
        const templates = JSON.parse(stored);
        this.meetingTemplates = new Map(templates);
      } catch {
        this.meetingTemplates = new Map();
      }
    }
  }

  /**
   * Public getters and utility methods
   */
  getExternalCalendars(): ExternalCalendar[] {
    return Array.from(this.externalCalendars.values());
  }

  getMeetingTemplates(): MeetingTemplate[] {
    return Array.from(this.meetingTemplates.values());
  }

  getCurrentTimeZone(): string {
    return this.timeZone;
  }

  setTimeZone(timeZone: string): void {
    this.timeZone = timeZone;
    localStorage.setItem("preferredTimeZone", timeZone);
  }

  convertToTimeZone(date: Date, timeZone: string): Date {
    return new Date(date.toLocaleString("en-US", { timeZone }));
  }

  formatEventTime(event: CalendarEvent, timeZone?: string): string {
    const tz = timeZone || this.timeZone;
    const start = this.convertToTimeZone(event.startTime, tz);
    const end = this.convertToTimeZone(event.endTime, tz);

    return `${start.toLocaleString()} - ${end.toLocaleTimeString()}`;
  }
}

export const calendarIntegrationService = new CalendarIntegrationService();
