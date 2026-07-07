import os
import re
import json
import base64
import gzip

def unpack():
    html_path = r"C:\Users\SmartanHouse005\Downloads\Smartan Varsity - Standalone.html"
    if not os.path.exists(html_path):
        print(f"File not found: {html_path}")
        return

    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()

    print(f"HTML file length: {len(html)}")

    # Locate manifest, template, ext_resources
    manifest_match = re.search(r'<script\s+type="__bundler/manifest"[^>]*>(.*?)</script>', html, re.DOTALL)
    template_match = re.search(r'<script\s+type="__bundler/template"[^>]*>(.*?)</script>', html, re.DOTALL)
    ext_resources_match = re.search(r'<script\s+type="__bundler/ext_resources"[^>]*>(.*?)</script>', html, re.DOTALL)

    if not manifest_match or not template_match:
        print("Error: Could not locate manifest or template script tags!")
        return

    manifest = json.loads(manifest_match.group(1).strip())
    template = json.loads(template_match.group(1).strip())
    ext_resources = json.loads(ext_resources_match.group(1).strip()) if ext_resources_match else []

    out_dir = r"C:\Users\SmartanHouse005\Downloads\unpacked_os"
    os.makedirs(out_dir, exist_ok=True)
    print(f"Output directory created: {out_dir}")

    # Unpack manifest assets
    unpacked_assets = {}
    for uuid, entry in manifest.items():
        mime = entry.get("mime", "")
        compressed = entry.get("compressed", False)
        data_b64 = entry.get("data", "")
        
        bytes_data = base64.b64decode(data_b64)
        if compressed:
            try:
                bytes_data = gzip.decompress(bytes_data)
            except Exception as e:
                print(f"Failed to decompress {uuid}: {e}")
                
        ext = "bin"
        if "html" in mime: ext = "html"
        elif "css" in mime: ext = "css"
        elif "javascript" in mime: ext = "js"
        elif "json" in mime: ext = "json"
        elif "image/png" in mime: ext = "png"
        elif "image/jpeg" in mime: ext = "jpg"
        elif "image/svg" in mime: ext = "svg"
        elif "font/woff2" in mime: ext = "woff2"
        
        filename = f"{uuid}.{ext}"
        # Let's see if we can find a original filename in the external resources mapping
        for res in ext_resources:
            if res.get("uuid") == uuid:
                # Clean name
                clean_name = os.path.basename(res.get("id", ""))
                if clean_name:
                    filename = clean_name
                    break
        
        file_path = os.path.join(out_dir, filename)
        with open(file_path, "wb") as out_f:
            out_f.write(bytes_data)
            
        unpacked_assets[uuid] = {
            "filename": filename,
            "path": file_path,
            "mime": mime,
            "size": len(bytes_data)
        }
        print(f"Unpacked {uuid} -> {filename} ({len(bytes_data)} bytes)")

    # Save template HTML
    template_path = os.path.join(out_dir, "template.html")
    with open(template_path, "w", encoding="utf-8") as out_f:
        out_f.write(template)

    # Let's save metadata mapping
    metadata_path = os.path.join(out_dir, "assets_info.json")
    with open(metadata_path, "w", encoding="utf-8") as out_f:
        json.dump({
            "assets": unpacked_assets,
            "ext_resources": ext_resources
        }, out_f, indent=2)

    print("Unpacking complete!")

if __name__ == "__main__":
    unpack()
