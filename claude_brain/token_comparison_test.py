#!/usr/bin/env python3
"""
Token Usage Comparison Test: Traditional vs Claude Brain approach
"""

import os
import sys
import tiktoken

# Set a dummy API key for search operations (no API calls needed for search)
os.environ['OPENAI_API_KEY'] = 'dummy-key-for-search-only'

from embeddings.retrieval_engine import search_embeddings

def count_tokens(text: str) -> int:
    """Count tokens in text using Claude's tokenizer."""
    encoding = tiktoken.get_encoding("cl100k_base")
    return len(encoding.encode(text, disallowed_special=()))

def test_traditional_approach(query: str, file_paths: list) -> dict:
    """Simulate traditional approach: read entire files."""
    total_content = ""
    files_read = []
    
    for file_path in file_paths:
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    total_content += f"\n\n## File: {file_path}\n\n{content}"
                    files_read.append(file_path)
            except Exception as e:
                print(f"Couldn't read {file_path}: {e}")
    
    token_count = count_tokens(total_content)
    
    return {
        "approach": "Traditional (full files)",
        "query": query,
        "files_included": files_read,
        "total_tokens": token_count,
        "content_preview": total_content[:500] + "..." if len(total_content) > 500 else total_content
    }

def test_claude_brain_approach(query: str, db_path: str = "embeddings.db", top_n: int = 5) -> dict:
    """Test Claude Brain approach: semantic search for relevant chunks."""
    results = search_embeddings(query, db_path, top_n)
    
    total_content = ""
    source_files = set()
    
    for similarity, source, content in results:
        total_content += f"\n\n## Relevant chunk from {source} (similarity: {similarity:.3f})\n\n{content}"
        # Extract file path from source metadata
        if "_chunk_" in source:
            file_path = source.split("_chunk_")[0]
            source_files.add(file_path)
        else:
            source_files.add(source)
    
    token_count = count_tokens(total_content)
    
    return {
        "approach": "Claude Brain (semantic chunks)",
        "query": query,
        "chunks_found": len(results),
        "source_files": list(source_files),
        "total_tokens": token_count,
        "content_preview": total_content[:500] + "..." if len(total_content) > 500 else total_content,
        "results": results
    }

def run_comparison_test(query: str, traditional_files: list, db_path: str = "embeddings.db"):
    """Run both approaches and compare token usage."""
    print("="*80)
    print(f"🧪 TOKEN COMPARISON TEST")
    print("="*80)
    print(f"Query: '{query}'")
    print()
    
    # Test traditional approach
    print("📁 Testing Traditional Approach (reading full files)...")
    traditional = test_traditional_approach(query, traditional_files)
    
    print("🧠 Testing Claude Brain Approach (semantic search)...")
    claude_brain = test_claude_brain_approach(query, db_path)
    
    # Compare results
    print("\n" + "="*80)
    print("📊 COMPARISON RESULTS")
    print("="*80)
    
    print(f"Traditional Approach:")
    print(f"  • Files read: {len(traditional['files_included'])}")
    print(f"  • Total tokens: {traditional['total_tokens']:,}")
    print(f"  • Files: {', '.join(os.path.basename(f) for f in traditional['files_included'])}")
    
    print(f"\nClaude Brain Approach:")
    print(f"  • Chunks found: {claude_brain['chunks_found']}")
    print(f"  • Total tokens: {claude_brain['total_tokens']:,}")
    print(f"  • Source files: {len(claude_brain['source_files'])}")
    print(f"  • Files: {', '.join(os.path.basename(f) for f in claude_brain['source_files'])}")
    
    # Calculate savings
    if traditional['total_tokens'] > 0:
        savings = traditional['total_tokens'] - claude_brain['total_tokens']
        savings_percent = (savings / traditional['total_tokens']) * 100
        
        print(f"\n💰 TOKEN SAVINGS:")
        print(f"  • Tokens saved: {savings:,}")
        print(f"  • Percentage saved: {savings_percent:.1f}%")
        print(f"  • Reduction factor: {traditional['total_tokens'] / claude_brain['total_tokens']:.1f}x smaller")
    
    return traditional, claude_brain

if __name__ == "__main__":
    # Example test cases for photo-process project
    test_cases = [
        {
            "query": "face recognition CompreFace API",
            "traditional_files": [
                "/mnt/hdd/photo-process/services/api/jobs/scan-job.ts",
                "/mnt/hdd/photo-process/services/api/package.json",
                "/mnt/hdd/photo-process/README.md",
                "/mnt/hdd/photo-process/services/api/README.md"
            ]
        },
        {
            "query": "mobile app React Native navigation",
            "traditional_files": [
                "/mnt/hdd/photo-process/services/mobile-app/package.json",
                "/mnt/hdd/photo-process/services/mobile-app/App.js"
            ]
        }
    ]
    
    db_path = "embeddings.db"
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{'='*20} TEST CASE {i} {'='*20}")
        run_comparison_test(
            test_case["query"], 
            test_case["traditional_files"], 
            db_path
        )
        print()