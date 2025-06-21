#!/usr/bin/env python3
"""
Simple Token Comparison: Compare manual file reading vs Claude Brain search
Run this with: python simple_token_test.py "your search query"
"""

import sys
import os
import tiktoken

def count_tokens(text: str) -> int:
    """Count tokens in text."""
    encoding = tiktoken.get_encoding("cl100k_base")
    return len(encoding.encode(text, disallowed_special=()))

def test_manual_approach(files_to_read: list) -> dict:
    """Read full files manually."""
    total_content = ""
    files_read = []
    
    for file_path in files_to_read:
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    total_content += f"\n\n## File: {file_path}\n\n{content}"
                    files_read.append(file_path)
                    print(f"✅ Read: {file_path} ({len(content)} chars)")
            except Exception as e:
                print(f"❌ Failed to read {file_path}: {e}")
    
    tokens = count_tokens(total_content)
    return {
        "files": files_read,
        "tokens": tokens,
        "content_length": len(total_content)
    }

def main():
    # Example files that might be relevant to face recognition
    example_files = [
        "/mnt/hdd/photo-process/services/api/jobs/scan-job.ts",
        "/mnt/hdd/photo-process/services/api/package.json", 
        "/mnt/hdd/photo-process/README.md",
        "/mnt/hdd/photo-process/services/api/README.md"
    ]
    
    print("🧪 TOKEN COMPARISON TEST")
    print("="*50)
    print("Step 1: Manual approach (reading full files)")
    print("="*50)
    
    manual_result = test_manual_approach(example_files)
    
    print(f"\n📊 MANUAL APPROACH RESULTS:")
    print(f"Files read: {len(manual_result['files'])}")
    print(f"Total characters: {manual_result['content_length']:,}")
    print(f"Total tokens: {manual_result['tokens']:,}")
    
    print(f"\n💰 Cost estimate (at Claude's rates):")
    # Rough estimate: $3 per million input tokens for Claude 3.5 Sonnet
    cost_estimate = (manual_result['tokens'] / 1_000_000) * 3
    print(f"Estimated cost: ${cost_estimate:.4f}")
    
    print(f"\n🧠 Now run this command to see Claude Brain results:")
    print(f"python claude_brain.py search \"face recognition CompreFace\" --show-content")
    print(f"\nThen manually count the tokens in the search results to compare!")
    
    print(f"\n📋 For easy comparison:")
    print(f"Manual approach: {manual_result['tokens']:,} tokens")
    print(f"Claude Brain: [run the search command above to find out]")

if __name__ == "__main__":
    main()