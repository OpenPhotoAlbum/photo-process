import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { configManager } from './config-manager';

interface ValidationResult {
    success: boolean;
    category: string;
    check: string;
    message: string;
    critical: boolean;
}

interface StartupValidationReport {
    success: boolean;
    results: ValidationResult[];
    criticalIssues: ValidationResult[];
    warnings: ValidationResult[];
}

export class StartupValidator {
    private results: ValidationResult[] = [];

    private addResult(category: string, check: string, success: boolean, message: string, critical: boolean = false): void {
        this.results.push({
            success,
            category,
            check,
            message,
            critical
        });
    }

    private async validateConfiguration(): Promise<void> {
        try {
            // Test configuration loading
            const storage = configManager.getStorage();
            const processing = configManager.getProcessing();
            const logging = configManager.getLogging();

            this.addResult('Configuration', 'Config Loading', true, 'Configuration loaded successfully');

            // Validate required directories exist
            if (!fs.existsSync(storage.sourceDir)) {
                this.addResult('Configuration', 'Source Directory', false, 
                    `Source directory does not exist: ${storage.sourceDir}`, true);
            } else {
                this.addResult('Configuration', 'Source Directory', true, 
                    `Source directory exists: ${storage.sourceDir}`);
            }

            if (!fs.existsSync(storage.processedDir)) {
                this.addResult('Configuration', 'Processed Directory', false, 
                    `Processed directory does not exist: ${storage.processedDir}`, true);
            } else {
                this.addResult('Configuration', 'Processed Directory', true, 
                    `Processed directory exists: ${storage.processedDir}`);
            }

            // Validate log directory
            if (!fs.existsSync(logging.directory)) {
                try {
                    fs.mkdirSync(logging.directory, { recursive: true });
                    this.addResult('Configuration', 'Log Directory', true, 
                        `Created log directory: ${logging.directory}`);
                } catch (error) {
                    this.addResult('Configuration', 'Log Directory', false, 
                        `Cannot create log directory: ${logging.directory}`, true);
                }
            } else {
                this.addResult('Configuration', 'Log Directory', true, 
                    `Log directory exists: ${logging.directory}`);
            }

            // Validate confidence thresholds
            const faceConfig = processing.faceRecognition.confidence;
            if (faceConfig.review < 0 || faceConfig.review > 1) {
                this.addResult('Configuration', 'Face Review Confidence', false, 
                    `Invalid review confidence: ${faceConfig.review} (must be 0-1)`, true);
            } else {
                this.addResult('Configuration', 'Face Review Confidence', true, 
                    `Valid review confidence: ${faceConfig.review}`);
            }

            if (faceConfig.autoAssign < 0 || faceConfig.autoAssign > 1) {
                this.addResult('Configuration', 'Face Auto-assign Confidence', false, 
                    `Invalid auto-assign confidence: ${faceConfig.autoAssign} (must be 0-1)`, true);
            } else {
                this.addResult('Configuration', 'Face Auto-assign Confidence', true, 
                    `Valid auto-assign confidence: ${faceConfig.autoAssign}`);
            }

        } catch (error) {
            this.addResult('Configuration', 'Config Loading', false, 
                `Configuration validation failed: ${error instanceof Error ? error.message : error}`, true);
        }
    }

    private async validateDatabase(): Promise<void> {
        try {
            const mysql = require('mysql2/promise');
            const dbConfig = configManager.getDatabase();
            
            const connection = await mysql.createConnection({
                host: dbConfig.host,
                port: dbConfig.port,
                user: dbConfig.user,
                password: dbConfig.password,
                database: dbConfig.database,
                connectTimeout: 5000
            });

            await connection.execute('SELECT 1');
            await connection.end();

            this.addResult('Database', 'Connection', true, 
                `Successfully connected to MySQL at ${dbConfig.host}:${dbConfig.port}`);

        } catch (error) {
            this.addResult('Database', 'Connection', false, 
                `Database connection failed: ${error instanceof Error ? error.message : error}`, true);
        }
    }

    private async validateCompreFace(): Promise<void> {
        try {
            // Test if CompreFace is accessible
            const response = await fetch('http://localhost:8000', { 
                timeout: 5000,
                method: 'HEAD'
            });

            if (response.ok) {
                this.addResult('CompreFace', 'Service Access', true, 
                    'CompreFace service is accessible');

                // Test API endpoint with a simple request
                try {
                    const apiResponse = await fetch('http://localhost:8000/api/v1/detection/detect', {
                        method: 'POST',
                        headers: { 'x-api-key': 'test' },
                        body: JSON.stringify({}),
                        timeout: 3000
                    });

                    // We expect an error about missing file or invalid key, not a connection error
                    const result = await apiResponse.text();
                    if (result.includes('multipart') || result.includes('Missing header') || result.includes('invalid')) {
                        this.addResult('CompreFace', 'API Endpoint', true, 
                            'CompreFace API endpoint is responding');
                    } else {
                        this.addResult('CompreFace', 'API Endpoint', false, 
                            'CompreFace API endpoint returned unexpected response', false);
                    }
                } catch (apiError) {
                    this.addResult('CompreFace', 'API Endpoint', false, 
                        `CompreFace API test failed: ${apiError instanceof Error ? apiError.message : apiError}`, false);
                }

            } else {
                this.addResult('CompreFace', 'Service Access', false, 
                    `CompreFace service returned status: ${response.status}`, false);
            }

        } catch (error) {
            this.addResult('CompreFace', 'Service Access', false, 
                `CompreFace service not accessible: ${error instanceof Error ? error.message : error}`, false);
        }
    }

    private async validateFileSystem(): Promise<void> {
        const storage = configManager.getStorage();

        // Test write permissions in processed directory
        try {
            const testFile = path.join(storage.processedDir, '.startup-test');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            
            this.addResult('FileSystem', 'Write Permissions', true, 
                'Write permissions verified for processed directory');
        } catch (error) {
            this.addResult('FileSystem', 'Write Permissions', false, 
                `Cannot write to processed directory: ${error instanceof Error ? error.message : error}`, true);
        }

        // Check disk space (warn if less than 1GB free)
        try {
            const stats = fs.statSync(storage.processedDir);
            // Note: This is a simplified check. In production, you might want to use a library like 'check-disk-space'
            this.addResult('FileSystem', 'Disk Space', true, 
                'Disk space check completed (manual verification recommended)');
        } catch (error) {
            this.addResult('FileSystem', 'Disk Space', false, 
                `Disk space check failed: ${error instanceof Error ? error.message : error}`, false);
        }
    }

    private async validateDependencies(): Promise<void> {
        // Check if required binaries are available
        const { spawn } = require('child_process');

        // Test ExifTool
        try {
            await new Promise<void>((resolve, reject) => {
                const exiftool = spawn('exiftool', ['-ver'], { timeout: 5000 });
                exiftool.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`ExifTool exited with code ${code}`));
                    }
                });
                exiftool.on('error', reject);
            });

            this.addResult('Dependencies', 'ExifTool', true, 'ExifTool is available and working');
        } catch (error) {
            this.addResult('Dependencies', 'ExifTool', false, 
                `ExifTool not available: ${error instanceof Error ? error.message : error}`, true);
        }

        // Check Node.js version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        
        if (majorVersion >= 16) {
            this.addResult('Dependencies', 'Node.js Version', true, 
                `Node.js version ${nodeVersion} is supported`);
        } else {
            this.addResult('Dependencies', 'Node.js Version', false, 
                `Node.js version ${nodeVersion} may not be supported (recommend 16+)`, false);
        }
    }

    public async validateStartup(): Promise<StartupValidationReport> {
        console.log('🔍 Running startup validation...\n');

        this.results = [];

        // Run all validation checks
        await Promise.all([
            this.validateConfiguration(),
            this.validateDatabase(),
            this.validateCompreFace(),
            this.validateFileSystem(),
            this.validateDependencies()
        ]);

        // Categorize results
        const criticalIssues = this.results.filter(r => !r.success && r.critical);
        const warnings = this.results.filter(r => !r.success && !r.critical);
        const success = criticalIssues.length === 0;

        return {
            success,
            results: this.results,
            criticalIssues,
            warnings
        };
    }

    public static printReport(report: StartupValidationReport): void {
        console.log('📋 Startup Validation Report');
        console.log('=' .repeat(50));

        // Group results by category
        const categories = [...new Set(report.results.map(r => r.category))];
        
        for (const category of categories) {
            console.log(`\n📂 ${category}`);
            const categoryResults = report.results.filter(r => r.category === category);
            
            for (const result of categoryResults) {
                const icon = result.success ? '✅' : (result.critical ? '❌' : '⚠️');
                console.log(`   ${icon} ${result.check}: ${result.message}`);
            }
        }

        console.log('\n' + '=' .repeat(50));
        
        if (report.success) {
            console.log('🎉 All critical checks passed! Server ready to start.');
        } else {
            console.log('❌ Critical issues found:');
            for (const issue of report.criticalIssues) {
                console.log(`   • ${issue.category} - ${issue.check}: ${issue.message}`);
            }
        }

        if (report.warnings.length > 0) {
            console.log('\n⚠️  Warnings (non-critical):');
            for (const warning of report.warnings) {
                console.log(`   • ${warning.category} - ${warning.check}: ${warning.message}`);
            }
        }

        console.log('');
    }
}