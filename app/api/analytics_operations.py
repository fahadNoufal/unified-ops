"""
Operational Analytics Endpoint
Provides capacity, scheduling, and service performance metrics
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime, timedelta
from typing import Dict, List
from collections import defaultdict

from app.core.database import get_db
from app.models.models import Booking, Service, BookingStatus, Contact, FormSubmission
from app.core.auth import get_current_user
from app.models.models import User

router = APIRouter()

@router.get("/analytics/operational-dashboard")
async def get_operational_dashboard(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get operational efficiency and service performance metrics
    """
    workspace_id = current_user.workspace_id
    now = datetime.utcnow()
    start_date = now - timedelta(days=days)
    
    # Get all bookings in date range
    bookings = db.query(Booking).filter(
        Booking.workspace_id == workspace_id,
        Booking.created_at >= start_date
    ).order_by(Booking.start_time).all()
    
    # Get all services
    services = db.query(Service).filter(
        Service.workspace_id == workspace_id
    ).all()
    
    # ============ OPERATIONAL EFFICIENCY METRICS ============
    
    # 1. Booking Density by Hour/Day (Heatmap Data)
    booking_density = calculate_booking_density(bookings)
    
    # 2. Idle Time & Gaps
    idle_time_data = calculate_idle_time(bookings)
    
    # 3. Most Requested Time Slots
    popular_time_slots = calculate_popular_time_slots(bookings)
    
    # 4. Service Duration Accuracy
    duration_accuracy = calculate_duration_accuracy(bookings, services)
    
    # 5. Double-Booking Risks
    double_booking_risk = calculate_double_booking_risk(bookings)
    
    # 6. Capacity Utilization
    capacity_utilization = calculate_capacity_utilization(bookings, workspace_id, days)
    
    # ============ SERVICE PERFORMANCE METRICS ============
    
    # 1. Service Popularity (Most/Least Popular)
    service_popularity = calculate_service_popularity(bookings, services)
    
    # 2. Service Completion Rates
    service_completion = calculate_service_completion(bookings, services)
    
    # 3. Service Profitability (if pricing available)
    service_profitability = calculate_service_profitability(bookings, services)
    
    # 4. Service Conversion Rates (form submission → booking)
    service_conversion = calculate_service_conversion(bookings, services, db, workspace_id, start_date)
    
    # 5. Service Mix Analysis
    service_mix = calculate_service_mix(bookings, services)
    
    # 6. Upselling Opportunities
    upselling_opportunities = identify_upselling_opportunities(bookings, services, db, workspace_id)
    
    return {
        "date_range": {
            "start": start_date.isoformat(),
            "end": now.isoformat(),
            "days": days
        },
        "operational_efficiency": {
            "booking_density": booking_density,
            "idle_time": idle_time_data,
            "popular_time_slots": popular_time_slots,
            "duration_accuracy": duration_accuracy,
            "double_booking_risk": double_booking_risk,
            "capacity_utilization": capacity_utilization
        },
        "service_performance": {
            "popularity": service_popularity,
            "completion_rates": service_completion,
            "profitability": service_profitability,
            "conversion_rates": service_conversion,
            "service_mix": service_mix,
            "upselling_opportunities": upselling_opportunities
        }
    }


def calculate_booking_density(bookings: List[Booking]) -> Dict:
    """Calculate booking density by hour and day of week"""
    density = defaultdict(lambda: defaultdict(int))
    
    for booking in bookings:
        if booking.start_time:
            day_of_week = booking.start_time.strftime('%A')
            hour = booking.start_time.hour
            density[day_of_week][hour] += 1
    
    # Convert to list format for heatmap
    heatmap_data = []
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    
    for day in days:
        for hour in range(8, 20):  # 8 AM to 8 PM
            heatmap_data.append({
                'day': day,
                'hour': hour,
                'count': density[day].get(hour, 0),
                'time_label': f"{hour:02d}:00"
            })
    
    return {
        'heatmap': heatmap_data,
        'peak_day': max(density.items(), key=lambda x: sum(x[1].values()))[0] if density else None,
        'peak_hour': max(
            [(day, hour, count) for day, hours in density.items() for hour, count in hours.items()],
            key=lambda x: x[2]
        )[1] if density else None
    }


def calculate_idle_time(bookings: List[Booking]) -> Dict:
    """Calculate gaps between bookings"""
    if len(bookings) < 2:
        return {'average_gap_minutes': 0, 'total_gaps': 0, 'idle_percentage': 0}
    
    # Sort by start time
    sorted_bookings = sorted([b for b in bookings if b.start_time], key=lambda x: x.start_time)
    
    gaps = []
    for i in range(len(sorted_bookings) - 1):
        current_end = sorted_bookings[i].end_time
        next_start = sorted_bookings[i + 1].start_time
        
        # Only count gaps on same day
        if current_end.date() == next_start.date():
            gap = (next_start - current_end).total_seconds() / 60
            if gap > 0:
                gaps.append(gap)
    
    if not gaps:
        return {'average_gap_minutes': 0, 'total_gaps': 0, 'idle_percentage': 0}
    
    total_idle_time = sum(gaps)
    total_booking_time = sum([(b.end_time - b.start_time).total_seconds() / 60 for b in sorted_bookings])
    idle_percentage = (total_idle_time / (total_idle_time + total_booking_time)) * 100 if total_booking_time > 0 else 0
    
    return {
        'average_gap_minutes': round(sum(gaps) / len(gaps), 1),
        'total_gaps': len(gaps),
        'idle_percentage': round(idle_percentage, 1),
        'longest_gap_minutes': round(max(gaps), 1),
        'shortest_gap_minutes': round(min(gaps), 1)
    }


def calculate_popular_time_slots(bookings: List[Booking]) -> List[Dict]:
    """Find most requested time slots"""
    time_slot_counts = defaultdict(int)
    
    for booking in bookings:
        if booking.start_time:
            # Round to hour slots
            hour = booking.start_time.hour
            time_slot = f"{hour:02d}:00 - {(hour+1):02d}:00"
            time_slot_counts[time_slot] += 1
    
    # Sort by popularity
    sorted_slots = sorted(time_slot_counts.items(), key=lambda x: x[1], reverse=True)
    
    return [
        {'time_slot': slot, 'booking_count': count, 'rank': idx + 1}
        for idx, (slot, count) in enumerate(sorted_slots[:10])
    ]


def calculate_duration_accuracy(bookings: List[Booking], services: List[Service]) -> Dict:
    """Compare actual vs planned duration"""
    service_map = {s.id: s for s in services}
    accuracies = []
    
    for booking in bookings:
        if booking.service_id in service_map and booking.start_time and booking.end_time:
            service = service_map[booking.service_id]
            planned_minutes = service.duration_minutes
            actual_minutes = (booking.end_time - booking.start_time).total_seconds() / 60
            
            accuracy = (min(planned_minutes, actual_minutes) / max(planned_minutes, actual_minutes)) * 100
            accuracies.append({
                'service_name': service.name,
                'planned': planned_minutes,
                'actual': actual_minutes,
                'accuracy': accuracy
            })
    
    if not accuracies:
        return {'average_accuracy': 100, 'services': []}
    
    return {
        'average_accuracy': round(sum([a['accuracy'] for a in accuracies]) / len(accuracies), 1),
        'services': accuracies[:10]  # Top 10
    }


def calculate_double_booking_risk(bookings: List[Booking]) -> Dict:
    """Identify overlapping bookings"""
    overlaps = []
    sorted_bookings = sorted([b for b in bookings if b.start_time], key=lambda x: x.start_time)
    
    for i in range(len(sorted_bookings)):
        for j in range(i + 1, len(sorted_bookings)):
            b1, b2 = sorted_bookings[i], sorted_bookings[j]
            
            # Check if they overlap
            if b1.end_time > b2.start_time and b1.start_time < b2.end_time:
                overlaps.append({
                    'booking1_id': b1.id,
                    'booking2_id': b2.id,
                    'overlap_minutes': min(
                        (b1.end_time - b2.start_time).total_seconds() / 60,
                        (b2.end_time - b1.start_time).total_seconds() / 60
                    )
                })
    
    return {
        'total_overlaps': len(overlaps),
        'risk_level': 'High' if len(overlaps) > 5 else 'Medium' if len(overlaps) > 0 else 'Low',
        'overlaps': overlaps[:5]  # Show first 5
    }


def calculate_capacity_utilization(bookings: List[Booking], workspace_id: int, days: int) -> Dict:
    """Calculate how well capacity is being used"""
    # Assuming 10 hours/day (8 AM - 6 PM), 7 days/week
    available_hours_per_day = 10
    total_available_hours = available_hours_per_day * days
    
    # Calculate actual booked hours
    booked_hours = sum([(b.end_time - b.start_time).total_seconds() / 3600 for b in bookings if b.start_time and b.end_time])
    
    utilization_percentage = (booked_hours / total_available_hours) * 100 if total_available_hours > 0 else 0
    
    return {
        'utilization_percentage': round(utilization_percentage, 1),
        'booked_hours': round(booked_hours, 1),
        'available_hours': total_available_hours,
        'idle_hours': round(total_available_hours - booked_hours, 1),
        'status': 'Excellent' if utilization_percentage > 80 else 'Good' if utilization_percentage > 60 else 'Low'
    }


def calculate_service_popularity(bookings: List[Booking], services: List[Service]) -> List[Dict]:
    """Calculate most/least popular services"""
    service_map = {s.id: s for s in services}
    service_counts = defaultdict(int)
    
    for booking in bookings:
        if booking.service_id:
            service_counts[booking.service_id] += 1
    
    popularity_list = []
    for service_id, count in service_counts.items():
        if service_id in service_map:
            service = service_map[service_id]
            popularity_list.append({
                'service_id': service_id,
                'service_name': service.name,
                'booking_count': count,
                'percentage': 0  # Will calculate after
            })
    
    # Calculate percentages
    total = sum([p['booking_count'] for p in popularity_list])
    for item in popularity_list:
        item['percentage'] = round((item['booking_count'] / total) * 100, 1) if total > 0 else 0
    
    # Sort by popularity
    popularity_list.sort(key=lambda x: x['booking_count'], reverse=True)
    
    return popularity_list


def calculate_service_completion(bookings: List[Booking], services: List[Service]) -> List[Dict]:
    """Calculate completion rates by service"""
    service_map = {s.id: s for s in services}
    service_stats = defaultdict(lambda: {'total': 0, 'completed': 0})
    
    for booking in bookings:
        if booking.service_id:
            service_stats[booking.service_id]['total'] += 1
            if booking.status == BookingStatus.COMPLETED:
                service_stats[booking.service_id]['completed'] += 1
    
    completion_rates = []
    for service_id, stats in service_stats.items():
        if service_id in service_map:
            service = service_map[service_id]
            completion_rate = (stats['completed'] / stats['total']) * 100 if stats['total'] > 0 else 0
            completion_rates.append({
                'service_name': service.name,
                'total_bookings': stats['total'],
                'completed': stats['completed'],
                'completion_rate': round(completion_rate, 1)
            })
    
    completion_rates.sort(key=lambda x: x['completion_rate'], reverse=True)
    return completion_rates


def calculate_service_profitability(bookings: List[Booking], services: List[Service]) -> List[Dict]:
    """Calculate revenue by service (if pricing available)"""
    service_map = {s.id: s for s in services}
    service_revenue = defaultdict(lambda: {'revenue': 0, 'count': 0})
    
    for booking in bookings:
        if booking.service_id and booking.service_id in service_map:
            service = service_map[booking.service_id]
            # Check if service has price attribute
            if hasattr(service, 'price') and service.price:
                service_revenue[booking.service_id]['revenue'] += float(service.price)
                service_revenue[booking.service_id]['count'] += 1
    
    profitability_list = []
    for service_id, data in service_revenue.items():
        if service_id in service_map:
            service = service_map[service_id]
            profitability_list.append({
                'service_name': service.name,
                'total_revenue': round(data['revenue'], 2),
                'booking_count': data['count'],
                'average_value': round(data['revenue'] / data['count'], 2) if data['count'] > 0 else 0
            })
    
    profitability_list.sort(key=lambda x: x['total_revenue'], reverse=True)
    
    if not profitability_list:
        return [{'message': 'Price data not available'}]
    
    return profitability_list


def calculate_service_conversion(bookings: List[Booking], services: List[Service], db: Session, workspace_id: int, start_date: datetime) -> List[Dict]:
    """Calculate conversion from form submission to booking by service"""
    # This is simplified - would need more logic to track "interest" properly
    service_map = {s.id: s for s in services}
    
    # Count bookings per service
    service_bookings = defaultdict(int)
    for booking in bookings:
        if booking.service_id:
            service_bookings[booking.service_id] += 1
    
    # Count form submissions (as proxy for interest)
    total_forms = db.query(func.count(FormSubmission.id)).filter(
        FormSubmission.submitted_at >= start_date
    ).scalar() or 1  # Avoid division by zero
    
    conversion_rates = []
    for service_id, booking_count in service_bookings.items():
        if service_id in service_map:
            service = service_map[service_id]
            # Simplified conversion rate
            conversion_rate = (booking_count / total_forms) * 100
            conversion_rates.append({
                'service_name': service.name,
                'bookings': booking_count,
                'conversion_rate': round(conversion_rate, 1)
            })
    
    conversion_rates.sort(key=lambda x: x['conversion_rate'], reverse=True)
    return conversion_rates


def calculate_service_mix(bookings: List[Booking], services: List[Service]) -> Dict:
    """Analyze service mix and balance"""
    service_map = {s.id: s for s in services}
    service_counts = defaultdict(int)
    
    for booking in bookings:
        if booking.service_id:
            service_counts[booking.service_id] += 1
    
    total_bookings = len(bookings)
    
    mix_data = []
    for service_id, count in service_counts.items():
        if service_id in service_map:
            service = service_map[service_id]
            percentage = (count / total_bookings) * 100 if total_bookings > 0 else 0
            mix_data.append({
                'service_name': service.name,
                'count': count,
                'percentage': round(percentage, 1)
            })
    
    mix_data.sort(key=lambda x: x['percentage'], reverse=True)
    
    # Calculate concentration (is it balanced or dominated by one service?)
    top_service_percentage = mix_data[0]['percentage'] if mix_data else 0
    balance_score = 'Balanced' if top_service_percentage < 40 else 'Concentrated'
    
    return {
        'services': mix_data,
        'balance_score': balance_score,
        'top_service': mix_data[0]['service_name'] if mix_data else None
    }


def identify_upselling_opportunities(bookings: List[Booking], services: List[Service], db: Session, workspace_id: int) -> List[Dict]:
    """Identify customers who book one service but might be interested in others"""
    # Get customers and their booking patterns
    customer_services = defaultdict(set)
    
    for booking in bookings:
        if booking.contact_id and booking.service_id:
            customer_services[booking.contact_id].add(booking.service_id)
    
    service_map = {s.id: s for s in services}
    
    # Find customers who only use one service
    single_service_customers = [
        contact_id for contact_id, services_used in customer_services.items()
        if len(services_used) == 1
    ]
    
    opportunities = []
    for contact_id in single_service_customers[:10]:  # Top 10
        contact = db.query(Contact).filter(Contact.id == contact_id).first()
        if contact:
            current_service_id = list(customer_services[contact_id])[0]
            current_service = service_map.get(current_service_id)
            
            # Suggest other services
            other_services = [s for s in services if s.id != current_service_id]
            
            if other_services:
                opportunities.append({
                    'contact_name': contact.name,
                    'contact_email': contact.email,
                    'current_service': current_service.name if current_service else 'Unknown',
                    'booking_count': len([b for b in bookings if b.contact_id == contact_id]),
                    'suggested_services': [s.name for s in other_services[:3]]
                })
    
    return opportunities