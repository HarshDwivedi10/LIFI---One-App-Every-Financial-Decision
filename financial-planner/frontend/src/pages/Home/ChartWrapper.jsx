import React, { Suspense } from 'react';
import DashboardCard from './DashboardCard';
import './DashboardPage.css';

export default function ChartWrapper({ 
  title, 
  icon, 
  iconBg, 
  iconColor, 
  headerRight,
  loading, 
  children 
}) {
  return (
    <DashboardCard
      title={title}
      icon={icon}
      iconBg={iconBg}
      iconColor={iconColor}
      headerRight={headerRight}
      loading={loading}
      skeletonLines={1}
    >
      <Suspense fallback={<div className="skeleton skeleton-chart" style={{ height: 200, width: '100%' }} />}>
        <div className="chart-container">
          {children}
        </div>
      </Suspense>
    </DashboardCard>
  );
}
