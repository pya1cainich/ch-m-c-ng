#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  CHẤM CÔNG PRO — Deploy to Android (double-click để chạy)
# ═══════════════════════════════════════════════════════════════

# Đổi sang thư mục chứa script này
cd "$(dirname "$0")"

# Màu sắc
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}   CHẤM CÔNG PRO — Build & Deploy to Android  ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""

# ── Tìm ADB ─────────────────────────────────────────────────
ADB=""
for p in \
    "$HOME/Library/Android/sdk/platform-tools/adb" \
    "/usr/local/bin/adb" \
    "/opt/homebrew/bin/adb" \
    "$(which adb 2>/dev/null)"; do
  if [ -x "$p" ]; then ADB="$p"; break; fi
done

if [ -z "$ADB" ]; then
  echo -e "${RED}❌ Không tìm thấy adb.${NC}"
  echo ""
  echo "Cài Android Studio hoặc chạy:"
  echo "  brew install android-platform-tools"
  echo ""
  read -p "Nhấn Enter để thoát..."
  exit 1
fi
echo -e "${GREEN}✓ ADB: $ADB${NC}"

# ── Kiểm tra điện thoại ─────────────────────────────────────
echo ""
echo -e "${YELLOW}⏳ Kiểm tra điện thoại kết nối...${NC}"
DEVICES=$("$ADB" devices 2>/dev/null | grep -v "List of devices" | grep "device$")

if [ -z "$DEVICES" ]; then
  echo -e "${RED}❌ Không thấy điện thoại.${NC}"
  echo ""
  echo "Kiểm tra:"
  echo "  1. Cắm USB vào máy"
  echo "  2. Bật USB Debugging (Settings → Developer options)"
  echo "  3. Chấp nhận popup 'Allow USB debugging' trên điện thoại"
  echo ""
  read -p "Nhấn Enter để thử lại sau khi kết nối..."
  DEVICES=$("$ADB" devices 2>/dev/null | grep -v "List of devices" | grep "device$")
  if [ -z "$DEVICES" ]; then
    echo -e "${RED}Vẫn không thấy điện thoại. Thoát.${NC}"
    read -p "Nhấn Enter để đóng..."; exit 1
  fi
fi
echo -e "${GREEN}✓ Điện thoại: $(echo "$DEVICES" | head -1 | awk '{print $1}')${NC}"

# ── Tìm Java ─────────────────────────────────────────────────
export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home 2>/dev/null)}"
if [ -z "$JAVA_HOME" ]; then
  for j in \
    "/Applications/Android Studio.app/Contents/jbr" \
    "/Applications/Android Studio.app/Contents/jre/Contents/Home"; do
    if [ -d "$j" ]; then JAVA_HOME="$j"; break; fi
  done
fi
[ -n "$JAVA_HOME" ] && echo -e "${GREEN}✓ Java: $JAVA_HOME${NC}" \
                     || echo -e "${YELLOW}⚠ JAVA_HOME không set — Gradle tự tìm${NC}"

# ── Build APK ────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}⏳ Build APK debug...${NC}"
cd android-build/android

chmod +x gradlew
./gradlew assembleDebug --quiet 2>&1
BUILD_RESULT=$?

if [ $BUILD_RESULT -ne 0 ]; then
  echo ""
  echo -e "${RED}❌ Build thất bại. Chạy lại với log đầy đủ:${NC}"
  echo "  cd $(pwd) && ./gradlew assembleDebug"
  read -p "Nhấn Enter để đóng..."; exit 1
fi

APK="app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK" ]; then
  echo -e "${RED}❌ Không tìm thấy APK tại $APK${NC}"
  read -p "Nhấn Enter để đóng..."; exit 1
fi

APK_SIZE=$(du -sh "$APK" | cut -f1)
echo -e "${GREEN}✓ Build xong — APK $APK_SIZE${NC}"

# ── Cài APK ──────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}⏳ Cài APK lên điện thoại...${NC}"
"$ADB" install -r "$APK" 2>&1
INSTALL_RESULT=$?

echo ""
if [ $INSTALL_RESULT -eq 0 ]; then
  echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✅ CÀI THÀNH CÔNG!                           ${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
  echo ""
  # Mở app tự động
  "$ADB" shell monkey -p com.chamcongpro.onepiece.v2 -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
  echo -e "${GREEN}  App đã được mở trên điện thoại.${NC}"
else
  echo -e "${RED}❌ Cài thất bại (code $INSTALL_RESULT)${NC}"
  echo ""
  echo "Thử gỡ app cũ rồi cài lại:"
  echo "  $ADB uninstall com.chamcongpro.onepiece.v2"
fi

echo ""
read -p "Nhấn Enter để đóng..."
