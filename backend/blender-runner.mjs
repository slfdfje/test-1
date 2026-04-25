import { spawn } from "child_process";
import fs from "fs";
import path from "path";

// Configuration
const BLENDER_PATH = process.env.BLENDER_PATH || 'C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe';
const GENERATION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const MAX_CONCURRENT_JOBS = 3;

// Job queue and tracking
const activeJobs = new Map();
const jobQueue = [];

/**
 * Spawn a Blender process to generate a 3D model
 * @param {string} jobId - Unique identifier for the job
 * @param {object} dimensions - Frame dimensions {frameWidth, bridgeWidth, templeLength}
 * @returns {Promise<string>} - Resolves with GLB file path on success
 */
export async function spawnBlenderJob(jobId, dimensions, imageDir = null) {
  const { frameWidth, bridgeWidth, templeLength } = dimensions;

  // Check if we're at the concurrent job limit
  if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
    console.log(`[Blender Runner] Job ${jobId} queued (${activeJobs.size}/${MAX_CONCURRENT_JOBS} active)`);
    return new Promise((resolve, reject) => {
      jobQueue.push({ jobId, dimensions, imageDir, resolve, reject });
    });
  }

  return executeBlenderJob(jobId, frameWidth, bridgeWidth, templeLength, imageDir);
}

/**
 * Execute a Blender job immediately
 */
function executeBlenderJob(jobId, frameWidth, bridgeWidth, templeLength, imageDir = null) {
  return new Promise((resolve, reject) => {
    console.log(`[Blender Runner] Starting job ${jobId} (${activeJobs.size + 1}/${MAX_CONCURRENT_JOBS})`);

    // Check if Blender exists
    if (!fs.existsSync(BLENDER_PATH)) {
      const error = new Error(`Blender not found at: ${BLENDER_PATH}`);
      error.code = 'BLENDER_NOT_FOUND';
      return reject(error);
    }

    // Build command arguments
    const args = [
      '--background',
      '--python', 'scripts/glasses_parametric.py',
      '--',
      frameWidth.toString(),
      bridgeWidth.toString(),
      templeLength.toString(),
      jobId
    ];

    // Pass image directory so the script can sample frame colour from photos
    if (imageDir && fs.existsSync(imageDir)) {
      args.push(imageDir);
      console.log(`[Blender Runner] Passing image dir for colour sampling: ${imageDir}`);
    }

    // Spawn Blender process
    const blender = spawn(BLENDER_PATH, args, {
      cwd: process.cwd()
    });

    // Track active job
    const jobInfo = {
      process: blender,
      startTime: Date.now(),
      stdout: '',
      stderr: ''
    };
    activeJobs.set(jobId, jobInfo);

    // Set timeout
    const timeout = setTimeout(() => {
      console.error(`[Blender Runner] Job ${jobId} timeout exceeded`);
      blender.kill('SIGTERM');
      
      const error = new Error('Generation timeout exceeded (5 minutes)');
      error.code = 'TIMEOUT';
      cleanupJob(jobId);
      reject(error);
    }, GENERATION_TIMEOUT);

    // Capture stdout
    blender.stdout.on('data', (data) => {
      const output = data.toString();
      jobInfo.stdout += output;
      console.log(`[Blender ${jobId}] ${output.trim()}`);
    });

    // Capture stderr
    blender.stderr.on('data', (data) => {
      const output = data.toString();
      jobInfo.stderr += output;
      console.error(`[Blender ${jobId} Error] ${output.trim()}`);
    });

    // Handle process completion
    blender.on('close', (code) => {
      clearTimeout(timeout);
      
      const duration = Date.now() - jobInfo.startTime;
      console.log(`[Blender Runner] Job ${jobId} completed in ${(duration / 1000).toFixed(1)}s with code ${code}`);

      if (code !== 0) {
        // Blender sometimes exits with code 1 even on success (headless quirk).
        // Check if the GLB file was actually created before treating as failure.
        const glbPath = path.join('output', `${jobId}.glb`);
        const glbExists = fs.existsSync(glbPath) && fs.statSync(glbPath).size > 0;

        if (!glbExists) {
          const error = new Error(`Blender process exited with code ${code}`);
          error.code = 'BLENDER_ERROR';
          error.exitCode = code;
          error.stderr = jobInfo.stderr;
          error.stdout = jobInfo.stdout;
          
          cleanupJob(jobId);
          return reject(error);
        }

        console.warn(`[Blender Runner] Job ${jobId} exited with code ${code} but GLB exists — treating as success`);
      }

      // Verify GLB file exists
      const glbPath = path.join('output', `${jobId}.glb`);
      
      if (!fs.existsSync(glbPath)) {
        const error = new Error(`GLB file not found after generation: ${glbPath}`);
        error.code = 'FILE_NOT_FOUND';
        error.stderr = jobInfo.stderr;
        
        cleanupJob(jobId);
        return reject(error);
      }

      // Verify file size
      const stats = fs.statSync(glbPath);
      if (stats.size === 0) {
        const error = new Error(`GLB file is empty: ${glbPath}`);
        error.code = 'EMPTY_FILE';
        
        cleanupJob(jobId);
        return reject(error);
      }

      console.log(`[Blender Runner] Job ${jobId} successful - GLB file: ${stats.size} bytes`);
      
      cleanupJob(jobId);
      resolve(`/output/${jobId}.glb`);
    });

    // Handle process errors
    blender.on('error', (error) => {
      clearTimeout(timeout);
      console.error(`[Blender Runner] Job ${jobId} process error:`, error);
      
      error.code = 'SPAWN_ERROR';
      cleanupJob(jobId);
      reject(error);
    });
  });
}

/**
 * Clean up after job completion and process queue
 */
function cleanupJob(jobId) {
  activeJobs.delete(jobId);
  
  // Process next job in queue if any
  if (jobQueue.length > 0 && activeJobs.size < MAX_CONCURRENT_JOBS) {
    const nextJob = jobQueue.shift();
    console.log(`[Blender Runner] Processing queued job ${nextJob.jobId} (${jobQueue.length} remaining in queue)`);
    
    executeBlenderJob(
      nextJob.jobId,
      nextJob.dimensions.frameWidth,
      nextJob.dimensions.bridgeWidth,
      nextJob.dimensions.templeLength,
      nextJob.imageDir || null
    )
      .then(nextJob.resolve)
      .catch(nextJob.reject);
  }
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error) {
  switch (error.code) {
    case 'BLENDER_NOT_FOUND':
      return 'Blender is not installed or not found at the expected location';
    
    case 'TIMEOUT':
      return 'Model generation took too long and was cancelled (timeout: 5 minutes)';
    
    case 'FILE_NOT_FOUND':
      return 'Blender completed but did not create the expected model file';
    
    case 'EMPTY_FILE':
      return 'Blender created an empty model file';
    
    case 'BLENDER_ERROR':
      // Try to extract meaningful error from stderr
      if (error.stderr) {
        const lines = error.stderr.split('\n');
        const tracebackIndex = lines.findIndex(line => line.includes('Traceback'));
        if (tracebackIndex !== -1) {
          // Extract the full traceback: from "Traceback" to the final error line
          const tracebackLines = lines.slice(tracebackIndex);
          // Find the last non-empty line which is typically the actual error
          const lastErrorLine = [...tracebackLines].reverse().find(l => l.trim().length > 0);
          // Include up to 10 lines of traceback for context
          const contextLines = tracebackLines.slice(0, 10).map(l => l.trim()).filter(l => l.length > 0);
          const summary = lastErrorLine ? lastErrorLine.trim() : contextLines[0];
          return `Blender script error: ${summary}\n${contextLines.join('\n')}`;
        }
        const errorLine = lines.find(line => 
          line.includes('Error') || 
          line.includes('Exception')
        );
        if (errorLine) {
          return `Blender script error: ${errorLine.trim()}`;
        }
      }
      return `Blender process failed with exit code ${error.exitCode}`;
    
    case 'SPAWN_ERROR':
      return `Failed to start Blender process: ${error.message}`;
    
    default:
      return `Model generation failed: ${error.message}`;
  }
}

/**
 * Get current job queue status
 */
export function getQueueStatus() {
  return {
    active: activeJobs.size,
    queued: jobQueue.length,
    maxConcurrent: MAX_CONCURRENT_JOBS,
    activeJobs: Array.from(activeJobs.keys())
  };
}

/**
 * Terminate a specific job
 */
export function terminateJob(jobId) {
  const jobInfo = activeJobs.get(jobId);
  if (jobInfo) {
    console.log(`[Blender Runner] Terminating job ${jobId}`);
    jobInfo.process.kill('SIGTERM');
    cleanupJob(jobId);
    return true;
  }
  return false;
}
