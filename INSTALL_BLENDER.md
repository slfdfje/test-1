# 🎨 Install Blender - Professional 3D Generation

## Step 1: Download Blender

### Windows (Your System):

**Option A: Official Installer (Recommended)**
1. Go to: https://www.blender.org/download/
2. Click "Download Blender 4.3" (or latest version)
3. Choose "Windows Installer (.msi)"
4. Download will start automatically

**Option B: Portable Version**
1. Same website
2. Choose "Portable (.zip)"
3. Extract to: `C:\Blender\`

---

## Step 2: Install Blender

### If you downloaded the installer (.msi):

1. **Run the installer**
   - Double-click the downloaded file
   - Click "Next" through the wizard
   - **IMPORTANT**: Check "Add Blender to PATH" ✅
   - Click "Install"
   - Wait for installation to complete

2. **Default installation path**:
   ```
   C:\Program Files\Blender Foundation\Blender 4.3\
   ```

### If you downloaded portable (.zip):

1. **Extract to a folder**:
   ```
   C:\Blender\
   ```

2. **Add to PATH manually** (see Step 3)

---

## Step 3: Add Blender to System PATH

This allows Node.js to find Blender from any directory.

### Method 1: Automatic (if installer added it)
- Skip to Step 4 to verify

### Method 2: Manual (if needed)

1. **Open Environment Variables**:
   - Press `Win + R`
   - Type: `sysdm.cpl`
   - Press Enter
   - Click "Advanced" tab
   - Click "Environment Variables"

2. **Edit PATH**:
   - Under "System variables", find "Path"
   - Click "Edit"
   - Click "New"
   - Add Blender path:
     ```
     C:\Program Files\Blender Foundation\Blender 4.3\
     ```
   - Click "OK" on all dialogs

3. **Restart Terminal**:
   - Close all PowerShell/CMD windows
   - Open new terminal

---

## Step 4: Verify Installation

Open a **NEW** PowerShell window and run:

```powershell
blender --version
```

**Expected output**:
```
Blender 4.3.0
Build date: 2024-XX-XX
```

If you see this, **Blender is installed correctly!** ✅

---

## Step 5: Test Blender with Python Script

Run this command from the backend folder:

```powershell
cd backend
blender --background --python scripts/glasses_parametric.py -- 140 20 145 test
```

**Expected**:
- Blender starts in background
- Python script runs
- Creates: `output/test.glb`
- Takes 5-10 seconds

---

## 🚨 Troubleshooting

### Issue: "blender is not recognized"

**Solution 1**: Restart terminal
- Close all terminals
- Open new PowerShell
- Try again

**Solution 2**: Check PATH
```powershell
$env:Path -split ';' | Select-String -Pattern 'Blender'
```
Should show Blender path

**Solution 3**: Use full path
```powershell
& "C:\Program Files\Blender Foundation\Blender 4.3\blender.exe" --version
```

### Issue: "Python script error"

**Solution**: Check script exists
```powershell
ls backend/scripts/glasses_parametric.py
```

### Issue: "No output file created"

**Solution**: Check output folder
```powershell
ls backend/output/
```

---

## 📦 Alternative: Chocolatey (Package Manager)

If you have Chocolatey installed:

```powershell
choco install blender
```

This automatically adds to PATH.

---

## 🎯 After Installation

Once Blender is installed and verified:

1. **Stop the test server**:
   - Go to terminal running `admin-workflow-server-no-blender.mjs`
   - Press `Ctrl+C`

2. **Start the professional server**:
   ```powershell
   cd backend
   node admin-workflow-server.mjs
   ```

3. **Test 3D generation**:
   - Go to: http://localhost:5173/admin-workflow.html
   - Upload glasses
   - Click "Generate Model"
   - Watch backend terminal for Blender output
   - Unique 3D model created in 5-10 seconds!

---

## 🎨 What You Get with Blender

### Without Blender (Current):
- ❌ Same test model for all glasses
- ❌ No customization
- ❌ Generic fit

### With Blender (Professional):
- ✅ Unique 3D model per glasses
- ✅ Custom dimensions (width, bridge, temple)
- ✅ Parametric generation
- ✅ Perfect fit for each style
- ✅ Professional quality
- ✅ 5-10 seconds per model

---

## 🚀 Professional Features Unlocked

1. **Parametric Modeling**
   - Adjust frame width (100-180mm)
   - Adjust bridge width (10-30mm)
   - Adjust temple length (120-160mm)

2. **Automatic Generation**
   - Upload image → Set dimensions → Generate
   - No manual 3D modeling needed
   - Consistent quality

3. **Scalable**
   - Generate 100+ models
   - Batch processing ready
   - Production-ready workflow

---

## 📊 System Comparison

| Feature | Test Model | Blender (Professional) |
|---------|-----------|------------------------|
| Unique models | ❌ | ✅ |
| Custom dimensions | ❌ | ✅ |
| Generation time | Instant | 5-10 seconds |
| Quality | Good | Professional |
| Scalability | Limited | Unlimited |
| Production ready | Testing only | ✅ Yes |

---

## 🎯 Next Steps

1. **Download Blender**: https://www.blender.org/download/
2. **Install** (check "Add to PATH")
3. **Verify**: `blender --version`
4. **Restart backend** with original server
5. **Generate professional models**!

---

## 💡 Pro Tip

After installing Blender, you can also:
- Manually edit generated models
- Add custom textures
- Export to other formats
- Use Blender's full power

---

**Ready to install? Follow the steps above!** 🎨
