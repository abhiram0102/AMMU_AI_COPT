import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";

export interface ToolResult {
  success: boolean;
  data: any;
  error?: string;
  riskLevel: "low" | "medium" | "high";
  executionTime: number;
  auditLog: {
    command: string;
    arguments: any;
    timestamp: Date;
    result: any;
  };
}

export interface NmapScanOptions {
  target: string;
  scanType: "ping" | "tcp" | "udp" | "syn" | "service";
  ports?: string;
  timeout?: number;
  maxTargets?: number;
}

export interface DomainIntelOptions {
  domain: string;
  includeSubdomains?: boolean;
  includeWhois?: boolean;
  includeDNS?: boolean;
}

class ToolsService {
  private allowedTargets = [
    "127.0.0.1",
    "localhost",
    /^192\.168\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./
  ];

  async executeTool(toolName: string, args: any): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      let result: any;
      let riskLevel: "low" | "medium" | "high" = "low";
      
      switch (toolName) {
        case "nmap":
          result = await this.executeNmap(args as NmapScanOptions);
          riskLevel = this.assessNmapRisk(args);
          break;
          
        case "domain_intel":
          result = await this.executeDomainIntel(args as DomainIntelOptions);
          riskLevel = "low";
          break;
          
        case "whois":
          result = await this.executeWhois(args.domain);
          riskLevel = "low";
          break;
          
        case "dns_lookup":
          result = await this.executeDNSLookup(args.domain, args.recordType);
          riskLevel = "low";
          break;
          
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: true,
        data: result,
        riskLevel,
        executionTime,
        auditLog: {
          command: toolName,
          arguments: args,
          timestamp: new Date(),
          result
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Unknown error",
        riskLevel: "high",
        executionTime,
        auditLog: {
          command: toolName,
          arguments: args,
          timestamp: new Date(),
          result: { error: error instanceof Error ? error.message : "Unknown error" }
        }
      };
    }
  }

  assessRiskLevel(toolName: string, args: any): "low" | "medium" | "high" {
    switch (toolName) {
      case "nmap":
        return this.assessNmapRisk(args);
        
      case "domain_intel":
      case "whois":
      case "dns_lookup":
        return "low";
        
      default:
        return "high";
    }
  }

  private async executeNmap(options: NmapScanOptions): Promise<any> {
    // Validate target
    if (!this.isTargetAllowed(options.target)) {
      throw new Error("Target not allowed. Only local/private networks are permitted.");
    }
    
    // Build nmap command
    const args = this.buildNmapArgs(options);
    
    // Execute nmap with restrictions
    const result = await this.executeCommand("nmap", args, {
      timeout: options.timeout || 30000,
      maxOutputSize: 1024 * 1024 // 1MB max output
    });
    
    // Parse nmap output
    return this.parseNmapOutput(result.stdout);
  }

  private async executeDomainIntel(options: DomainIntelOptions): Promise<any> {
    const results: any = {
      domain: options.domain,
      timestamp: new Date()
    };
    
    // DNS lookup
    if (options.includeDNS !== false) {
      try {
        results.dns = await this.executeDNSLookup(options.domain, "A");
      } catch (error) {
        results.dns = { error: error instanceof Error ? error.message : "DNS lookup failed" };
      }
    }
    
    // WHOIS lookup
    if (options.includeWhois) {
      try {
        results.whois = await this.executeWhois(options.domain);
      } catch (error) {
        results.whois = { error: error instanceof Error ? error.message : "WHOIS lookup failed" };
      }
    }
    
    // Subdomain enumeration (passive only)
    if (options.includeSubdomains) {
      try {
        results.subdomains = await this.enumerateSubdomains(options.domain);
      } catch (error) {
        results.subdomains = { error: error instanceof Error ? error.message : "Subdomain enumeration failed" };
      }
    }
    
    return results;
  }

  private async executeWhois(domain: string): Promise<any> {
    const result = await this.executeCommand("whois", [domain], {
      timeout: 10000
    });
    
    return this.parseWhoisOutput(result.stdout);
  }

  private async executeDNSLookup(domain: string, recordType: string = "A"): Promise<any> {
    const result = await this.executeCommand("dig", [
      "+short",
      domain,
      recordType
    ], {
      timeout: 5000
    });
    
    return {
      domain,
      recordType,
      records: result.stdout.trim().split('\n').filter(line => line.length > 0),
      timestamp: new Date()
    };
  }

  private async enumerateSubdomains(domain: string): Promise<any> {
    // Passive subdomain enumeration using DNS queries
    // In production, you might use external APIs like SecurityTrails, VirusTotal, etc.
    
    const commonSubdomains = [
      "www", "mail", "ftp", "admin", "test", "dev", "staging", "api",
      "blog", "shop", "support", "portal", "secure", "vpn"
    ];
    
    const foundSubdomains = [];
    
    for (const subdomain of commonSubdomains) {
      try {
        const fullDomain = `${subdomain}.${domain}`;
        const result = await this.executeDNSLookup(fullDomain, "A");
        
        if (result.records.length > 0) {
          foundSubdomains.push({
            subdomain: fullDomain,
            records: result.records
          });
        }
      } catch (error) {
        // Subdomain doesn't exist, continue
      }
    }
    
    return {
      domain,
      subdomains: foundSubdomains,
      method: "passive_dns",
      timestamp: new Date()
    };
  }

  private async executeCommand(
    command: string,
    args: string[],
    options: { timeout?: number; maxOutputSize?: number } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: options.timeout || 30000
      });
      
      let stdout = "";
      let stderr = "";
      let outputSize = 0;
      const maxSize = options.maxOutputSize || 1024 * 1024;
      
      child.stdout.on("data", (data) => {
        outputSize += data.length;
        if (outputSize > maxSize) {
          child.kill();
          reject(new Error("Output size limit exceeded"));
          return;
        }
        stdout += data.toString();
      });
      
      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      
      child.on("close", (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0
        });
      });
      
      child.on("error", (error) => {
        reject(error);
      });
    });
  }

  private buildNmapArgs(options: NmapScanOptions): string[] {
    const args = [];
    
    // Basic security restrictions
    args.push("-T2"); // Polite timing
    args.push("--max-rate", "100"); // Rate limiting
    args.push("--max-retries", "1");
    
    // Scan type
    switch (options.scanType) {
      case "ping":
        args.push("-sn"); // Ping scan only
        break;
      case "tcp":
        args.push("-sT"); // TCP connect scan
        break;
      case "syn":
        args.push("-sS"); // SYN scan (requires root)
        break;
      case "udp":
        args.push("-sU"); // UDP scan
        break;
      case "service":
        args.push("-sV"); // Service version detection
        break;
    }
    
    // Port specification
    if (options.ports) {
      args.push("-p", options.ports);
    } else {
      args.push("--top-ports", "100"); // Limit to top 100 ports
    }
    
    // Output format
    args.push("-oX", "-"); // XML output to stdout
    
    // Target
    args.push(options.target);
    
    return args;
  }

  private parseNmapOutput(xmlOutput: string): any {
    // Simple XML parsing for nmap output
    // In production, use a proper XML parser
    
    const results = {
      timestamp: new Date(),
      target: "",
      status: "unknown",
      ports: [] as any[],
      services: [] as any[]
    };
    
    // Extract basic information using regex (simplified)
    const hostMatch = xmlOutput.match(/<host[^>]*>/);
    if (hostMatch) {
      const statusMatch = xmlOutput.match(/<status\s+state="([^"]+)"/);
      if (statusMatch) {
        results.status = statusMatch[1];
      }
    }
    
    // Extract port information
    const portMatches = xmlOutput.matchAll(/<port\s+protocol="([^"]+)"\s+portid="([^"]+)"[^>]*>(.*?)<\/port>/gs);
    for (const match of portMatches) {
      const protocol = match[1];
      const portId = match[2];
      const portXml = match[3];
      
      const stateMatch = portXml.match(/<state\s+state="([^"]+)"/);
      const serviceMatch = portXml.match(/<service\s+name="([^"]+)"[^>]*>/);
      
      const portInfo = {
        protocol,
        port: parseInt(portId),
        state: stateMatch ? stateMatch[1] : "unknown",
        service: serviceMatch ? serviceMatch[1] : "unknown"
      };
      
      results.ports.push(portInfo);
      
      if (portInfo.state === "open") {
        results.services.push(portInfo);
      }
    }
    
    return results;
  }

  private parseWhoisOutput(whoisText: string): any {
    const lines = whoisText.split('\n');
    const result: any = {
      raw: whoisText,
      parsed: {}
    };
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim().toLowerCase();
        const value = line.substring(colonIndex + 1).trim();
        
        if (value) {
          result.parsed[key] = value;
        }
      }
    }
    
    return result;
  }

  private isTargetAllowed(target: string): boolean {
    // Only allow localhost and private IP ranges
    for (const allowedPattern of this.allowedTargets) {
      if (typeof allowedPattern === "string") {
        if (target === allowedPattern) return true;
      } else if (allowedPattern instanceof RegExp) {
        if (allowedPattern.test(target)) return true;
      }
    }
    return false;
  }

  private assessNmapRisk(options: NmapScanOptions): "low" | "medium" | "high" {
    let risk: "low" | "medium" | "high" = "low";
    
    // Aggressive scan types increase risk
    if (options.scanType === "syn" || options.scanType === "udp") {
      risk = "medium";
    }
    
    // Service detection increases risk
    if (options.scanType === "service") {
      risk = "medium";
    }
    
    // External targets increase risk significantly
    if (!this.isTargetAllowed(options.target)) {
      risk = "high";
    }
    
    return risk;
  }
}

export const toolsService = new ToolsService();
