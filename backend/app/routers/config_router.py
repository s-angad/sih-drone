from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from app.database import get_db
from app.models.models import SystemConfig
from app.services.hazard_detector import hazard_detector

router = APIRouter(prefix="/api/settings", tags=["Trainer Configuration & Calibration"])

@router.get("")
def get_system_settings(db: Session = Depends(get_db)):
    configs = db.query(SystemConfig).all()
    config_dict = {c.config_key: c.config_value for c in configs}
    return {
        "configurations": config_dict,
        "sensor_thresholds": hazard_detector.THRESHOLDS,
        "educational_disclaimer": (
            "Educational calibration limits: Designed for vocational pedagogical feedback. "
            "Not certified occupational exposure limits (OEL/PEL/TLV)."
        )
    }

@router.post("/update")
def update_system_setting(payload: Dict[str, str], db: Session = Depends(get_db)):
    for k, v in payload.items():
        conf = db.query(SystemConfig).filter(SystemConfig.config_key == k).first()
        if conf:
            conf.config_value = str(v)
        else:
            conf = SystemConfig(config_key=k, config_value=str(v))
            db.add(conf)
    db.commit()
    return {"message": "Settings updated successfully"}

@router.post("/thresholds")
def update_sensor_thresholds(payload: Dict[str, Any]):
    """Allows trainer to configure diagnostic sensitivity rules"""
    for sensor_type, thresh in payload.items():
        if sensor_type in hazard_detector.THRESHOLDS:
            hazard_detector.THRESHOLDS[sensor_type].update(thresh)
    return {"message": "Thresholds updated", "current": hazard_detector.THRESHOLDS}
