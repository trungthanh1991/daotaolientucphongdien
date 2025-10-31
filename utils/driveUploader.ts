/****************************************
 * 🔧 Helper: Convert a Blob to Base64 string
 ****************************************/
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        // Remove data:mime/type;base64, prefix
        resolve(reader.result.split(",")[1]);
      } else {
        reject(new Error("Failed to convert blob to base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/****************************************
 * 🚀 Upload to Google Drive (via Apps Script)
 ****************************************/
export const uploadToDrive = async (
  file: Blob,
  username: string
): Promise<{ success: boolean; id?: string; url?: string; error?: string }> => {
  // ✅ Must match Script Property 'API_TOKEN' in Code.gs
  const API_TOKEN = "Thamhoa@12345";

  // ✅ Dùng URL dạng /exec (Deploy → Web App → Anyone)
  const SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbwNArRXXFCQyRPgsT8f9ymliqSR1_sWHNF8ThTH7cLrWz9C-ro_acYLZDIUVHkQVwEzkw/exec";

  try {
    const base64Data = await blobToBase64(file);

    const payload = {
      token: API_TOKEN,
      action: "upload",
      username: username,
      data: base64Data,
      mimeType: file.type,
    };

    // ✅ Dùng text/plain để tránh preflight CORS
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: JSON.stringify(payload),
      redirect: "follow",
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => `HTTP status ${res.status}`);
      throw new Error(`Upload failed: ${errorText}`);
    }

    const result = await res.json();
    if (!result.success) {
      throw new Error(result.error || "Unknown error from upload script.");
    }

    console.log("✅ Upload success:", result);
    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("❌ Upload failed:", errorMessage);
    return { success: false, error: errorMessage };
  }
};


/****************************************
 * 🗑️ Delete from Google Drive (via Apps Script)
 ****************************************/
export const deleteFromDrive = async (
  fileId: string
): Promise<{ success: boolean; error?: string }> => {
  const API_TOKEN = "Thamhoa@12345";
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwNArRXXFCQyRPgsT8f9ymliqSR1_sWHNF8ThTH7cLrWz9C-ro_acYLZDIUVHkQVwEzkw/exec";

  try {
    const payload = {
      token: API_TOKEN,
      action: "delete",
      fileId: fileId,
    };

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => `HTTP status ${res.status}`);
      throw new Error(`Delete failed: ${errorText}`);
    }

    const result = await res.json();
    if (!result.success) {
      throw new Error(result.error || "Unknown error from delete script.");
    }
    
    console.log("✅ Delete success:", result);
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("❌ Delete failed:", errorMessage);
    return { success: false, error: errorMessage };
  }
};


/****************************************
 * 🔗 Utility: Extract File ID from URL
 ****************************************/
export const extractFileIdFromUrl = (url?: string): string | null => {
  if (!url) return null;
  const idRegex = /(?:file\/d\/|uc\?id=|open\?id=|d\/)([a-zA-Z0-9_-]{28,})/;
  const match = url.match(idRegex);
  if (match && match[1]) {
    return match[1];
  }
  if (!url.includes("/") && url.length > 25) {
    return url;
  }
  return null;
};


/****************************************
 * 🔗 Utility: Normalize Google Drive link
 ****************************************/
export const transformGoogleDriveUrl = (url?: string): string => {
  if (!url) return "";

  const fileId = extractFileIdFromUrl(url);
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  
  return url;
};