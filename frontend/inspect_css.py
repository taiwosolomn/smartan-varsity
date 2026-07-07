import os
import re

def inspect():
    template_path = r"C:\Users\SmartanHouse005\Downloads\unpacked_os\template.html"
    if not os.path.exists(template_path):
        print("Template not found!")
        return
        
    with open(template_path, "r", encoding="utf-8") as f:
        html = f.read()

    classes = set(re.findall(r'class="([^"]+)"', html))
    print(f"Total unique classes: {len(classes)}")
    print("\n=== CLASS LIST ===")
    for c in sorted(list(classes)):
        print(f"  {c}")

if __name__ == "__main__":
    inspect()
