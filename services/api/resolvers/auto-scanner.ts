import { Request, Response } from 'express';
import { logger } from '../util/structured-logger';
import fs from 'fs';
import path from 'path';

// Auto-scanner control state file
const AUTO_SCANNER_STATE_FILE = '/tmp/auto-scanner-control.json';

interface AutoScannerState {
  enabled: boolean;
  pausedAt?: string;
  pausedBy?: string;
  reason?: string;
  lastStatusCheck?: string;
}

// Initialize state file if it doesn't exist
const initializeStateFile = (): AutoScannerState => {
  const defaultState: AutoScannerState = {
    enabled: true,
    lastStatusCheck: new Date().toISOString()
  };
  
  if (!fs.existsSync(AUTO_SCANNER_STATE_FILE)) {
    fs.writeFileSync(AUTO_SCANNER_STATE_FILE, JSON.stringify(defaultState, null, 2));
  }
  
  return defaultState;
};

// Read current state
const readState = (): AutoScannerState => {
  try {
    if (fs.existsSync(AUTO_SCANNER_STATE_FILE)) {
      const data = fs.readFileSync(AUTO_SCANNER_STATE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error('Failed to read auto-scanner state file', { error });
  }
  
  return initializeStateFile();
};

// Write state
const writeState = (state: AutoScannerState): void => {
  try {
    fs.writeFileSync(AUTO_SCANNER_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    logger.error('Failed to write auto-scanner state file', { error });
  }
};

/**
 * Get auto-scanner status and control state
 */
export const getAutoScannerStatus = async (req: Request, res: Response) => {
  try {
    const state = readState();
    
    // Update last status check
    state.lastStatusCheck = new Date().toISOString();
    writeState(state);
    
    // Check if auto-scanner Docker container is running
    const { exec } = require('child_process');
    const containerStatus = await new Promise<string>((resolve) => {
      exec('docker ps -a --filter "name=photo-auto-scanner" --format "{{.Status}}"', (error: any, stdout: string) => {
        if (error) {
          resolve('unknown');
        } else {
          resolve(stdout.trim());
        }
      });
    });
    
    const isContainerRunning = containerStatus.includes('Up');
    
    res.json({
      success: true,
      autoScanner: {
        controlState: state.enabled ? 'enabled' : 'paused',
        containerStatus: isContainerRunning ? 'running' : 'stopped',
        pausedAt: state.pausedAt,
        pausedBy: state.pausedBy,
        reason: state.reason,
        lastStatusCheck: state.lastStatusCheck,
        canScan: state.enabled && isContainerRunning
      }
    });
    
  } catch (error) {
    logger.error('Failed to get auto-scanner status', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get auto-scanner status'
    });
  }
};

/**
 * Pause auto-scanner (prevents new scans)
 */
export const pauseAutoScanner = async (req: Request, res: Response) => {
  try {
    const { reason = 'Manual pause' } = req.body;
    
    const state = readState();
    state.enabled = false;
    state.pausedAt = new Date().toISOString();
    state.pausedBy = 'api-user';
    state.reason = reason;
    
    writeState(state);
    
    logger.info('Auto-scanner paused', { reason, pausedBy: 'api-user' });
    
    res.json({
      success: true,
      message: 'Auto-scanner paused successfully',
      state: {
        enabled: state.enabled,
        pausedAt: state.pausedAt,
        reason: state.reason
      }
    });
    
  } catch (error) {
    logger.error('Failed to pause auto-scanner', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to pause auto-scanner'
    });
  }
};

/**
 * Resume auto-scanner (allows new scans)
 */
export const resumeAutoScanner = async (req: Request, res: Response) => {
  try {
    const state = readState();
    state.enabled = true;
    state.pausedAt = undefined;
    state.pausedBy = undefined;
    state.reason = undefined;
    
    writeState(state);
    
    logger.info('Auto-scanner resumed');
    
    res.json({
      success: true,
      message: 'Auto-scanner resumed successfully',
      state: {
        enabled: state.enabled
      }
    });
    
  } catch (error) {
    logger.error('Failed to resume auto-scanner', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to resume auto-scanner'
    });
  }
};

/**
 * Check if auto-scanner should process (used by auto-scanner service)
 */
export const checkScanAllowed = async (req: Request, res: Response) => {
  try {
    const state = readState();
    
    res.json({
      allowed: state.enabled,
      reason: state.enabled ? 'Auto-scanner enabled' : (state.reason || 'Auto-scanner paused'),
      pausedAt: state.pausedAt
    });
    
  } catch (error) {
    logger.error('Failed to check scan permission', { error });
    res.status(500).json({
      allowed: false,
      reason: 'Error checking auto-scanner state'
    });
  }
};

/**
 * Stop auto-scanner Docker container
 */
export const stopAutoScannerContainer = async (req: Request, res: Response) => {
  try {
    const { exec } = require('child_process');
    
    const result = await new Promise<{ success: boolean; output: string }>((resolve) => {
      exec('docker stop photo-auto-scanner', (error: any, stdout: string, stderr: string) => {
        if (error) {
          resolve({ success: false, output: stderr || error.message });
        } else {
          resolve({ success: true, output: stdout });
        }
      });
    });
    
    if (result.success) {
      // Also pause the control state
      const state = readState();
      state.enabled = false;
      state.pausedAt = new Date().toISOString();
      state.pausedBy = 'api-user';
      state.reason = 'Container stopped via API';
      writeState(state);
      
      logger.info('Auto-scanner container stopped');
      
      res.json({
        success: true,
        message: 'Auto-scanner container stopped successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to stop auto-scanner container',
        details: result.output
      });
    }
    
  } catch (error) {
    logger.error('Failed to stop auto-scanner container', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to stop auto-scanner container'
    });
  }
};

/**
 * Start auto-scanner Docker container
 */
export const startAutoScannerContainer = async (req: Request, res: Response) => {
  try {
    const { exec } = require('child_process');
    
    const result = await new Promise<{ success: boolean; output: string }>((resolve) => {
      exec('docker start photo-auto-scanner', (error: any, stdout: string, stderr: string) => {
        if (error) {
          resolve({ success: false, output: stderr || error.message });
        } else {
          resolve({ success: true, output: stdout });
        }
      });
    });
    
    if (result.success) {
      // Also resume the control state
      const state = readState();
      state.enabled = true;
      state.pausedAt = undefined;
      state.pausedBy = undefined;
      state.reason = undefined;
      writeState(state);
      
      logger.info('Auto-scanner container started');
      
      res.json({
        success: true,
        message: 'Auto-scanner container started successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to start auto-scanner container',
        details: result.output
      });
    }
    
  } catch (error) {
    logger.error('Failed to start auto-scanner container', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to start auto-scanner container'
    });
  }
};