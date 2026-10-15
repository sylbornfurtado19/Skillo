'use client';

import { Bar } from 'react-chartjs-2';
import '../../../src/lib/chartSetup';

interface CalibrationBin {
  lowerBound: number;
  upperBound: number;
  count: number;
  meanConfidence: number;
  accuracy: number;
}

interface CalibrationChartProps {
  bins: CalibrationBin[];
}

export default function CalibrationChart({ bins }: CalibrationChartProps) {
  const populatedBins = bins.filter((bin) => bin.count > 0);

  return (
    <div className="h-[360px] w-full">
      <Bar
        data={{
          labels: populatedBins.map(
            (bin) => `${Math.round(bin.lowerBound * 100)}–${Math.round(bin.upperBound * 100)}%`
          ),
          datasets: [
            {
              label: 'Mean confidence',
              data: populatedBins.map((bin) => Math.round(bin.meanConfidence * 100)),
              backgroundColor: 'rgba(155, 34, 24, 0.78)',
              borderColor: '#9B2218',
              borderWidth: 1,
            },
            {
              label: 'Accuracy',
              data: populatedBins.map((bin) => Math.round(bin.accuracy * 100)),
              backgroundColor: 'rgba(58, 117, 82, 0.78)',
              borderColor: '#3A7552',
              borderWidth: 1,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              title: { display: true, text: 'Percentage' },
            },
            x: {
              title: { display: true, text: 'Confidence bin' },
            },
          },
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: (context) => `${context.dataset.label}: ${context.parsed.y}%`,
              },
            },
          },
        }}
      />
    </div>
  );
}
