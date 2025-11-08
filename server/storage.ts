import { type User, type InsertUser, type CommunitySubmission, type InsertCommunitySubmission, type Alert, type NeighborhoodsGeoJSON } from "@shared/schema";
import { randomUUID } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getNeighborhoods(): Promise<NeighborhoodsGeoJSON>;
  setNeighborhoods(geojson: NeighborhoodsGeoJSON): Promise<void>;
  
  getAlerts(): Promise<Alert[]>;
  addAlert(alert: Omit<Alert, "id" | "timestamp">): Promise<Alert>;
  removeAlert(id: string): Promise<void>;
  
  getCommunitySubmissions(): Promise<CommunitySubmission[]>;
  addCommunitySubmission(submission: InsertCommunitySubmission): Promise<CommunitySubmission>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private alerts: Map<string, Alert>;
  private submissions: Map<string, CommunitySubmission>;
  private neighborhoodsPath: string;
  private alertsPath: string;
  private submissionsPath: string;

  constructor() {
    this.users = new Map();
    this.alerts = new Map();
    this.submissions = new Map();
    
    this.neighborhoodsPath = join(process.cwd(), 'server', 'data', 'neighborhoods.geojson');
    this.alertsPath = join(process.cwd(), 'server', 'data', 'alerts.json');
    this.submissionsPath = join(process.cwd(), 'server', 'data', 'submissions.json');
    
    this.loadAlerts();
    this.loadSubmissions();
  }

  private loadAlerts(): void {
    try {
      if (existsSync(this.alertsPath)) {
        const data = readFileSync(this.alertsPath, 'utf-8');
        const alerts: Alert[] = JSON.parse(data);
        alerts.forEach(alert => this.alerts.set(alert.id, alert));
        console.log(`[Storage] Loaded ${alerts.length} alerts from disk`);
      }
    } catch (error) {
      console.error('[Storage] Error loading alerts:', error);
    }
  }

  private saveAlerts(): void {
    try {
      const alerts = Array.from(this.alerts.values());
      writeFileSync(this.alertsPath, JSON.stringify(alerts, null, 2));
    } catch (error) {
      console.error('[Storage] Error saving alerts:', error);
    }
  }

  private loadSubmissions(): void {
    try {
      if (existsSync(this.submissionsPath)) {
        const data = readFileSync(this.submissionsPath, 'utf-8');
        const submissions: CommunitySubmission[] = JSON.parse(data);
        submissions.forEach(sub => this.submissions.set(sub.id, sub));
        console.log(`[Storage] Loaded ${submissions.length} community submissions from disk`);
      }
    } catch (error) {
      console.error('[Storage] Error loading submissions:', error);
    }
  }

  private saveSubmissions(): void {
    try {
      const submissions = Array.from(this.submissions.values());
      writeFileSync(this.submissionsPath, JSON.stringify(submissions, null, 2));
    } catch (error) {
      console.error('[Storage] Error saving submissions:', error);
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getNeighborhoods(): Promise<NeighborhoodsGeoJSON> {
    try {
      const data = readFileSync(this.neighborhoodsPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('[Storage] Error loading neighborhoods:', error);
      return { type: "FeatureCollection", features: [] };
    }
  }

  async setNeighborhoods(geojson: NeighborhoodsGeoJSON): Promise<void> {
    try {
      writeFileSync(this.neighborhoodsPath, JSON.stringify(geojson, null, 2));
      console.log('[Storage] Neighborhoods updated');
    } catch (error) {
      console.error('[Storage] Error saving neighborhoods:', error);
      throw error;
    }
  }

  async getAlerts(): Promise<Alert[]> {
    return Array.from(this.alerts.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async addAlert(alert: Omit<Alert, "id" | "timestamp">): Promise<Alert> {
    const newAlert: Alert = {
      ...alert,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    this.alerts.set(newAlert.id, newAlert);
    this.saveAlerts();
    return newAlert;
  }

  async removeAlert(id: string): Promise<void> {
    this.alerts.delete(id);
    this.saveAlerts();
  }

  async getCommunitySubmissions(): Promise<CommunitySubmission[]> {
    return Array.from(this.submissions.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async addCommunitySubmission(submission: InsertCommunitySubmission): Promise<CommunitySubmission> {
    const newSubmission: CommunitySubmission = {
      ...submission,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    this.submissions.set(newSubmission.id, newSubmission);
    this.saveSubmissions();
    return newSubmission;
  }
}

export const storage = new MemStorage();
