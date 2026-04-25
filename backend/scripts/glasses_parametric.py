"""
Realistic Glasses 3D Model Generator - Direct Mesh Build
=========================================================
Builds a proper glasses model using bmesh (direct vertex/edge/face construction).
Coordinate system:
  X = left/right (positive = right)
  Y = front/back (positive = front, negative = back/behind head)
  Z = up/down    (positive = up)

Glasses face the +Y direction (front view).
Temple arms extend in the -Y direction (going back over ears).
"""

import bpy
import bmesh
import sys
import os
import math
from mathutils import Vector, Matrix

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
argv = sys.argv
try:
    sep = argv.index("--")
    argv = argv[sep + 1:]
except ValueError:
    argv = []

frame_width_mm  = float(argv[0]) if len(argv) > 0 else 140.0
bridge_width_mm = float(argv[1]) if len(argv) > 1 else 20.0
temple_len_mm   = float(argv[2]) if len(argv) > 2 else 145.0
job_id          = argv[3]        if len(argv) > 3 else "preview"

base_path = os.getcwd()
output_file = os.path.join(base_path, "output", f"{job_id}.glb")
os.makedirs(os.path.join(base_path, "output"), exist_ok=True)

print(f"[GlassesGen] frame={frame_width_mm}mm bridge={bridge_width_mm}mm temple={temple_len_mm}mm")
print(f"[GlassesGen] Output: {output_file}")

# ---------------------------------------------------------------------------
# Scene reset
# ---------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# ---------------------------------------------------------------------------
# Measurements (all in mm, Blender units = mm here)
# ---------------------------------------------------------------------------
FW  = frame_width_mm        # total frame width  e.g. 140
BW  = bridge_width_mm       # bridge gap          e.g. 20
TL  = temple_len_mm         # temple arm length   e.g. 145

# Lens oval dimensions
lens_w  = (FW - BW) / 2.0   # half-width of one lens  e.g. 30
lens_h  = lens_w * 0.75     # half-height              e.g. 22.5
lens_cx = BW / 2.0 + lens_w # X centre of right lens   e.g. 40

frame_tube_r = 2.2           # frame tube radius (mm)
temple_tube_r = 1.8          # temple arm tube radius
hinge_r = 2.5                # hinge cylinder radius
hinge_h = 6.0                # hinge height (along Z)

# ---------------------------------------------------------------------------
# Material helpers
# ---------------------------------------------------------------------------

def make_material(name, color, metallic=0.0, roughness=0.4, alpha=1.0, ior=1.45):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    if alpha < 1.0:
        # blend_method / shadow_method removed in Blender 4.2+; use surface_render_method
        try:
            mat.blend_method = 'BLEND'
        except AttributeError:
            pass
        try:
            mat.shadow_method = 'NONE'
        except AttributeError:
            pass
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out  = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value  = (*color, 1.0)
    bsdf.inputs['Metallic'].default_value    = metallic
    bsdf.inputs['Roughness'].default_value   = roughness
    bsdf.inputs['Alpha'].default_value       = alpha
    # IOR
    if 'IOR' in bsdf.inputs:
        bsdf.inputs['IOR'].default_value = ior
    # Transmission (Blender 4.x = 'Transmission Weight', older = 'Transmission')
    for key in ('Transmission Weight', 'Transmission'):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = 1.0 - alpha
            break
    return mat

mat_frame  = make_material("Frame",  (0.05, 0.05, 0.05), metallic=0.9, roughness=0.1)
mat_lens   = make_material("Lens",   (0.75, 0.90, 1.00), metallic=0.0, roughness=0.0, alpha=0.15)
mat_hinge  = make_material("Hinge",  (0.70, 0.70, 0.72), metallic=1.0, roughness=0.05)
mat_temple = make_material("Temple", (0.05, 0.05, 0.05), metallic=0.9, roughness=0.1)

# ---------------------------------------------------------------------------
# Helper: create a tube (circle profile swept along a polyline path)
# ---------------------------------------------------------------------------

def tube_along_points(name, points, radius, segments=12, mat=None, cap=True):
    """
    Extrude a circle of `radius` along a list of Vector points.
    Returns the created object.
    """
    bm = bmesh.new()

    # Build the profile circle in the XZ plane (will be oriented per segment)
    def circle_verts(center, normal, up, r, n):
        """Return n vertices of a circle at `center` with given normal."""
        # Build local frame
        normal = normal.normalized()
        # Find a perpendicular vector
        if abs(normal.dot(Vector((0, 0, 1)))) < 0.99:
            right = normal.cross(Vector((0, 0, 1))).normalized()
        else:
            right = normal.cross(Vector((1, 0, 0))).normalized()
        up_local = normal.cross(right).normalized()
        verts = []
        for i in range(n):
            angle = 2 * math.pi * i / n
            v = center + right * (r * math.cos(angle)) + up_local * (r * math.sin(angle))
            verts.append(bm.verts.new(v))
        return verts

    all_rings = []
    for i, pt in enumerate(points):
        if i == 0:
            direction = (points[1] - points[0]).normalized()
        elif i == len(points) - 1:
            direction = (points[-1] - points[-2]).normalized()
        else:
            direction = (points[i+1] - points[i-1]).normalized()
        ring = circle_verts(pt, direction, Vector((0, 0, 1)), radius, segments)
        all_rings.append(ring)

    # Connect rings with quad faces
    for i in range(len(all_rings) - 1):
        r0 = all_rings[i]
        r1 = all_rings[i + 1]
        n = len(r0)
        for j in range(n):
            j1 = (j + 1) % n
            bm.faces.new([r0[j], r0[j1], r1[j1], r1[j]])

    # Cap ends
    if cap:
        bm.faces.new(all_rings[0])
        bm.faces.new(list(reversed(all_rings[-1])))

    bm.normal_update()

    mesh = bpy.data.meshes.new(name + "_mesh")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj


# ---------------------------------------------------------------------------
# Helper: oval ring (lens frame) using tube_along_points
# ---------------------------------------------------------------------------

def make_lens_frame(name, cx, cz, w, h, tube_r, mat, segments=48):
    """
    Oval frame centred at (cx, 0, cz) in the XZ plane (glasses face +Y).
    w = half-width, h = half-height of the oval.
    """
    pts = []
    for i in range(segments + 1):
        angle = 2 * math.pi * i / segments
        x = cx + w * math.cos(angle)
        z = cz + h * math.sin(angle)
        pts.append(Vector((x, 0, z)))
    return tube_along_points(name, pts, tube_r, segments=10, mat=mat, cap=False)


# ---------------------------------------------------------------------------
# Helper: flat oval disc (lens surface)
# ---------------------------------------------------------------------------

def make_lens_disc(name, cx, cz, w, h, mat, segments=64):
    bm = bmesh.new()
    verts = []
    for i in range(segments):
        angle = 2 * math.pi * i / segments
        x = cx + w * math.cos(angle)
        z = cz + h * math.sin(angle)
        verts.append(bm.verts.new(Vector((x, 0.1, z))))  # slight Y offset to avoid z-fighting
    bm.faces.new(verts)
    bm.normal_update()
    mesh = bpy.data.meshes.new(name + "_mesh")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj


# ---------------------------------------------------------------------------
# Bridge: curved bar in XZ plane connecting the two lens frames
# ---------------------------------------------------------------------------

def make_bridge(bridge_w, cz, tube_r, mat, segments=20):
    """
    Curved bridge from (-bridge_w/2, 0, cz) to (+bridge_w/2, 0, cz)
    with a slight downward dip in the middle.
    """
    half = bridge_w / 2.0
    dip  = bridge_w * 0.3   # downward dip (Z direction)
    pts = []
    for i in range(segments + 1):
        t = i / segments          # 0 → 1
        # Quadratic bezier: P0=(−half,cz), P1=(0, cz−dip), P2=(+half, cz)
        x = (1-t)**2 * (-half) + 2*(1-t)*t * 0 + t**2 * half
        z = (1-t)**2 * cz      + 2*(1-t)*t * (cz - dip) + t**2 * cz
        pts.append(Vector((x, 0, z)))
    return tube_along_points("Bridge", pts, tube_r, segments=10, mat=mat, cap=True)


# ---------------------------------------------------------------------------
# Nose pad: small flattened sphere
# ---------------------------------------------------------------------------

def make_nose_pad(name, x, z, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=2.0, segments=12, ring_count=8,
        location=(x, 1.5, z)
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (0.5, 0.3, 0.7)
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


# ---------------------------------------------------------------------------
# Hinge: small cylinder at the outer edge of each lens frame
# ---------------------------------------------------------------------------

def make_hinge(name, x, cz, mat):
    """Vertical cylinder (along Z axis) at the outer edge of the frame."""
    bpy.ops.mesh.primitive_cylinder_add(
        radius=hinge_r, depth=hinge_h,
        vertices=16,
        location=(x, 0, cz)
    )
    obj = bpy.context.active_object
    obj.name = name
    # Cylinder default is along Z — that's correct (vertical hinge pin)
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


# ---------------------------------------------------------------------------
# Temple arm: goes from hinge backward (-Y direction) then curves down
# ---------------------------------------------------------------------------

def make_temple(name, start_x, temple_len, cz, tube_r, mat, side=1):
    """
    Temple arm starting at (start_x, 0, cz), going in -Y direction,
    then curving down at the ear hook end.
    side: +1 = right, -1 = left
    """
    straight_len = temple_len * 0.75   # straight portion
    hook_len     = temple_len * 0.25   # curved ear hook portion
    hook_drop    = 15.0                # how far down the hook drops (mm)

    pts = []
    # Straight section: from hinge going backward (-Y)
    straight_steps = 20
    for i in range(straight_steps + 1):
        t = i / straight_steps
        x = start_x  # temples go straight back, no X change
        y = -t * straight_len
        z = cz - t * 3.0   # very slight downward slope
        pts.append(Vector((x, y, z)))

    # Ear hook: curves downward
    hook_steps = 15
    hook_start_y = -straight_len
    hook_start_z = cz - 3.0
    for i in range(1, hook_steps + 1):
        t = i / hook_steps
        # Quadratic bezier curving down and slightly back
        y = hook_start_y - t * hook_len * 0.3
        z = hook_start_z - t * hook_drop
        pts.append(Vector((x, y, z)))

    return tube_along_points(name, pts, tube_r, segments=10, mat=mat, cap=True)


# ---------------------------------------------------------------------------
# BUILD THE GLASSES
# ---------------------------------------------------------------------------

# Lens centre Z (vertical centre of lenses)
lens_cz = 0.0

print(f"[GlassesGen] lens_w={lens_w:.1f} lens_h={lens_h:.1f} lens_cx={lens_cx:.1f}")

# --- Lens frames (oval rings) ---
right_frame = make_lens_frame("RightLensFrame",  lens_cx, lens_cz, lens_w, lens_h, frame_tube_r, mat_frame)
left_frame  = make_lens_frame("LeftLensFrame",  -lens_cx, lens_cz, lens_w, lens_h, frame_tube_r, mat_frame)

# --- Lens discs (transparent glass) ---
right_lens = make_lens_disc("RightLens",  lens_cx, lens_cz, lens_w - frame_tube_r, lens_h - frame_tube_r, mat_lens)
left_lens  = make_lens_disc("LeftLens",  -lens_cx, lens_cz, lens_w - frame_tube_r, lens_h - frame_tube_r, mat_lens)

# --- Bridge ---
bridge_obj = make_bridge(BW, lens_cz, frame_tube_r * 0.85, mat_frame)

# --- Nose pads ---
pad_x = BW * 0.3
pad_z = lens_cz - lens_h * 0.3
right_pad = make_nose_pad("RightNosePad",  pad_x, pad_z, mat_frame)
left_pad  = make_nose_pad("LeftNosePad",  -pad_x, pad_z, mat_frame)

# --- Hinges ---
hinge_x = lens_cx + lens_w + 1.0   # just outside the lens frame
right_hinge = make_hinge("RightHinge",  hinge_x, lens_cz, mat_hinge)
left_hinge  = make_hinge("LeftHinge",  -hinge_x, lens_cz, mat_hinge)

# --- Temple arms ---
# Start just past the hinge, go backward in -Y
right_temple = make_temple("RightTemple",  hinge_x, TL, lens_cz, temple_tube_r, mat_temple, side= 1)
left_temple  = make_temple("LeftTemple",  -hinge_x, TL, lens_cz, temple_tube_r, mat_temple, side=-1)

print(f"[GlassesGen] All parts created")

# ---------------------------------------------------------------------------
# Centre the whole model at origin
# ---------------------------------------------------------------------------
all_objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']

# Compute combined bounding box
min_v = Vector((float('inf'),  float('inf'),  float('inf')))
max_v = Vector((float('-inf'), float('-inf'), float('-inf')))
for obj in all_objs:
    for corner in obj.bound_box:
        wc = obj.matrix_world @ Vector(corner)
        min_v.x = min(min_v.x, wc.x)
        min_v.y = min(min_v.y, wc.y)
        min_v.z = min(min_v.z, wc.z)
        max_v.x = max(max_v.x, wc.x)
        max_v.y = max(max_v.y, wc.y)
        max_v.z = max(max_v.z, wc.z)

centre = (min_v + max_v) / 2.0
for obj in all_objs:
    obj.location -= centre

print(f"[GlassesGen] Centred model. Bounds: {min_v} → {max_v}")

# ---------------------------------------------------------------------------
# Export GLB
# ---------------------------------------------------------------------------
bpy.ops.object.select_all(action='SELECT')
try:
    bpy.ops.export_scene.gltf(
        filepath=output_file,
        export_format='GLB',
        export_materials='EXPORT',
        export_apply=True,
        export_cameras=False,
        export_lights=False,
    )
    print(f"[GlassesGen] Exported: {output_file}")
except Exception as e:
    import traceback
    print(f"[GlassesGen] EXPORT ERROR: {e}")
    traceback.print_exc()
    sys.exit(1)

print("[GlassesGen] Done!")
