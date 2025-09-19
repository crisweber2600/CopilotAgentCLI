/**
 * NDJSON Reader Utility
 * 
 * This module provides utilities for reading and parsing NDJSON (Newline Delimited JSON)
 * files, particularly for task specifications in the agent-swarmable framework.
 */

import { promises as fs } from 'node:fs';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

/**
 * Options for NDJSON reading operations
 */
export interface NDJSONReaderOptions {
  /** Validate each JSON object against a schema */
  validateSchema?: boolean;
  
  /** Skip invalid lines instead of throwing errors */
  skipInvalidLines?: boolean;
  
  /** Maximum number of lines to read */
  maxLines?: number;
  
  /** Filter function to apply to each parsed object */
  filter?: (obj: any) => boolean;
  
  /** Transform function to apply to each parsed object */
  transform?: (obj: any) => any;
}

/**
 * Result of NDJSON reading operation
 */
export interface NDJSONReadResult<T = any> {
  /** Successfully parsed objects */
  data: T[];
  
  /** Number of lines processed */
  linesProcessed: number;
  
  /** Number of valid objects parsed */
  validObjects: number;
  
  /** Number of invalid lines skipped */
  invalidLines: number;
  
  /** Parsing errors encountered */
  errors: Array<{ line: number; error: string; content: string }>;
}

/**
 * NDJSON streaming reader class
 */
export class NDJSONReader<T = any> {
  private options: NDJSONReaderOptions;
  
  constructor(options: NDJSONReaderOptions = {}) {
    this.options = {
      validateSchema: false,
      skipInvalidLines: false,
      maxLines: undefined,
      ...options
    };
  }
  
  /**
   * Read and parse an NDJSON file
   */
  async readFile(filePath: string): Promise<NDJSONReadResult<T>> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parseContent(content);
    } catch (error) {
      throw new Error(`Failed to read NDJSON file: ${(error as Error).message}`);
    }
  }
  
  /**
   * Parse NDJSON content from a string
   */
  parseContent(content: string): NDJSONReadResult<T> {
    const lines = content.split('\n').filter(line => line.trim() !== '');
    const result: NDJSONReadResult<T> = {
      data: [],
      linesProcessed: 0,
      validObjects: 0,
      invalidLines: 0,
      errors: []
    };
    
    const maxLines = this.options.maxLines ?? lines.length;
    const linesToProcess = Math.min(lines.length, maxLines);
    
    for (let i = 0; i < linesToProcess; i++) {
      const line = lines[i];
      result.linesProcessed++;
      
      try {
        const parsed = JSON.parse(line);
        
        // Apply filter if provided
        if (this.options.filter && !this.options.filter(parsed)) {
          continue;
        }
        
        // Apply transform if provided
        const obj = this.options.transform ? this.options.transform(parsed) : parsed;
        
        result.data.push(obj);
        result.validObjects++;
      } catch (error) {
        result.invalidLines++;
        result.errors.push({
          line: i + 1,
          error: (error as Error).message,
          content: line
        });
        
        if (!this.options.skipInvalidLines) {
          throw new Error(`Invalid JSON on line ${i + 1}: ${(error as Error).message}`);
        }
      }
    }
    
    return result;
  }
  
  /**
   * Stream-read an NDJSON file with callback processing
   */
  async streamFile(
    filePath: string, 
    callback: (obj: T, lineNumber: number) => void | Promise<void>
  ): Promise<NDJSONReadResult<T>> {
    return new Promise((resolve, reject) => {
      const result: NDJSONReadResult<T> = {
        data: [],
        linesProcessed: 0,
        validObjects: 0,
        invalidLines: 0,
        errors: []
      };
      
      const fileStream = createReadStream(filePath);
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      
      let lineNumber = 0;
      
      rl.on('line', async (line) => {
        lineNumber++;
        result.linesProcessed++;
        
        if (this.options.maxLines && lineNumber > this.options.maxLines) {
          rl.close();
          return;
        }
        
        if (line.trim() === '') {
          return;
        }
        
        try {
          const parsed = JSON.parse(line);
          
          // Apply filter if provided
          if (this.options.filter && !this.options.filter(parsed)) {
            return;
          }
          
          // Apply transform if provided
          const obj = this.options.transform ? this.options.transform(parsed) : parsed;
          
          result.data.push(obj);
          result.validObjects++;
          
          await callback(obj, lineNumber);
        } catch (error) {
          result.invalidLines++;
          result.errors.push({
            line: lineNumber,
            error: (error as Error).message,
            content: line
          });
          
          if (!this.options.skipInvalidLines) {
            rl.close();
            reject(new Error(`Invalid JSON on line ${lineNumber}: ${(error as Error).message}`));
            return;
          }
        }
      });
      
      rl.on('close', () => {
        resolve(result);
      });
      
      rl.on('error', (error) => {
        reject(new Error(`Failed to read NDJSON file: ${error.message}`));
      });
    });
  }
}

/**
 * Utility functions for NDJSON operations
 */
export class NDJSONUtils {
  /**
   * Write objects to an NDJSON file
   */
  static async writeFile(filePath: string, objects: any[]): Promise<void> {
    const lines = objects.map(obj => JSON.stringify(obj));
    const content = lines.join('\n') + (lines.length > 0 ? '\n' : '');
    await fs.writeFile(filePath, content, 'utf-8');
  }
  
  /**
   * Append objects to an NDJSON file
   */
  static async appendFile(filePath: string, objects: any[]): Promise<void> {
    const lines = objects.map(obj => JSON.stringify(obj));
    const content = lines.map(line => line + '\n').join('');
    await fs.appendFile(filePath, content, 'utf-8');
  }
  
  /**
   * Validate that a file contains valid NDJSON
   */
  static async validateFile(filePath: string): Promise<{ valid: boolean; errors: string[] }> {
    const reader = new NDJSONReader({ skipInvalidLines: true });
    
    try {
      const result = await reader.readFile(filePath);
      return {
        valid: result.errors.length === 0,
        errors: result.errors.map(err => `Line ${err.line}: ${err.error}`)
      };
    } catch (error) {
      return {
        valid: false,
        errors: [(error as Error).message]
      };
    }
  }
  
  /**
   * Count objects in an NDJSON file
   */
  static async countObjects(filePath: string): Promise<number> {
    const reader = new NDJSONReader({ skipInvalidLines: true });
    const result = await reader.readFile(filePath);
    return result.validObjects;
  }
  
  /**
   * Filter objects from an NDJSON file
   */
  static async filterFile<T>(
    inputPath: string, 
    outputPath: string, 
    predicate: (obj: T) => boolean
  ): Promise<number> {
    const reader = new NDJSONReader<T>({ 
      skipInvalidLines: true,
      filter: predicate
    });
    
    const result = await reader.readFile(inputPath);
    await this.writeFile(outputPath, result.data);
    return result.data.length;
  }
  
  /**
   * Transform objects in an NDJSON file
   */
  static async transformFile<T, U>(
    inputPath: string, 
    outputPath: string, 
    transformer: (obj: T) => U
  ): Promise<number> {
    const reader = new NDJSONReader<T>({ 
      skipInvalidLines: true,
      transform: transformer
    });
    
    const result = await reader.readFile(inputPath);
    await this.writeFile(outputPath, result.data);
    return result.data.length;
  }
  
  /**
   * Merge multiple NDJSON files into one
   */
  static async mergeFiles(inputPaths: string[], outputPath: string): Promise<number> {
    const allObjects: any[] = [];
    
    for (const inputPath of inputPaths) {
      const reader = new NDJSONReader({ skipInvalidLines: true });
      const result = await reader.readFile(inputPath);
      allObjects.push(...result.data);
    }
    
    await this.writeFile(outputPath, allObjects);
    return allObjects.length;
  }
}

/**
 * Convenience function to read an NDJSON file with default options
 */
export async function readNDJSON<T = any>(filePath: string, options?: NDJSONReaderOptions): Promise<T[]> {
  const reader = new NDJSONReader<T>(options);
  const result = await reader.readFile(filePath);
  return result.data;
}

/**
 * Convenience function to write an NDJSON file
 */
export async function writeNDJSON(filePath: string, objects: any[]): Promise<void> {
  await NDJSONUtils.writeFile(filePath, objects);
}